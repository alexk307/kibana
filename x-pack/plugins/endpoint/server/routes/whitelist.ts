/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { IRouter, RequestHandlerContext, APICaller } from 'kibana/server';
import { schema } from '@kbn/config-schema';
import { SearchResponse } from 'elasticsearch';
import { createHash } from 'crypto';
import { i18n } from '@kbn/i18n';

import lzma from 'lzma-native';
import querystring from 'querystring';
import request from 'request';
import { WhitelistRule, WhitelistSet } from '../../common/types';
import { EndpointAppContext } from '../types';

const whitelistIdx: string = 'whitelist'; // TODO: change this
const allowlistBaseRoute: string = '/api/endpoint/allowlist';
const whitelistLimit: number = 1000;
let whitelistArtifactCache: Buffer = Buffer.from([]);

export async function startCache(client: APICaller) {
  setInterval(async () => {
    await hydrateWhitelistCache(client);
  }, 5000);
}

/**
 * Registers the whitelist routes for the API
 */
export function registerWhitelistRoutes(router: IRouter, endpointAppContext: EndpointAppContext) {
  router.get(
    {
      path: allowlistBaseRoute,
      validate: {},
      options: { authRequired: true },
    },
    handleWhitelistGet
  );

  router.get(
    {
      path: '/api/endpoint/manifest',
      validate: {},
      options: { authRequired: true },
    },
    handleWhitelistManifest
  );
  router.get(
    {
      path: `${allowlistBaseRoute}/download/{hash}`,
      validate: {
        params: schema.object({
          hash: schema.string(),
        }),
      },
      options: { authRequired: true },
    },
    handleWhitelistDownload
  );

  router.post(
    {
      path: allowlistBaseRoute,
      validate: {
        body: schema.object({
          comment: schema.maybe(schema.string()), // Optional comment explaining reason for whitelist
          event_types: schema.arrayOf(schema.string()),
          file_path: schema.maybe(schema.string()),
          signer: schema.maybe(schema.string()),
          sha256: schema.maybe(schema.string()),
          dismiss: schema.boolean({ defaultValue: false }), // Boolean determining if we dismiss all alerts that match this
        }),
      },
      options: { authRequired: true },
    },
    handleWhitelistPost
  );

  router.delete(
    {
      path: allowlistBaseRoute,
      validate: {
        body: schema.object({
          whitelist_id: schema.string(),
        }),
      },
      options: { authRequired: true },
    },
    handleWhitelistItemDeletion
  );
}

/**
 * Handles the POST request for whitelist additions
 */
async function handleWhitelistPost(context: RequestHandlerContext, req, res) {
  try {
    const eventTypes: string[] = req.body.eventTypes;
    const whitelistAttributeMap: Record<string, string> = {
      file_path: 'malware.file.path',
      acting_process_path: 'actingProcess.file.path',
      signer: 'malware.file.signer',
      sha256: 'malware.file.hashes.sha256',
    };
    const newRules: WhitelistRule[] = [];
    Object.keys(whitelistAttributeMap).forEach(k => {
      if (req.body[k]) {
        newRules.push({
          comment: req.body.comment || '',
          event_types: eventTypes,
          entry_type: 'simple',
          entry: {
            comparison: 'equality',
            value: req.body[k],
            apply_to: whitelistAttributeMap[k],
          },
        });
      }
    });

    // Don't index an empty list if no rules could be created from the request
    if (newRules.length === 0) {
      return res.badRequest({
        error: i18n.translate('allowlist.badrequest', {
          defaultMessage: 'No allowlist rules could be created from request.',
        }),
      });
    }

    const whitelistCount: number = await getNumWhitelistRules(context);
    if (whitelistCount < 0) {
      return res.internalError({
        error: i18n.translate('allowlist.internalerror', {
          defaultMessage: 'Unable to create allowlist items',
        }),
      });
    }

    // Check that the global whitelist size limit won't be reached
    if (newRules.length + whitelistCount > whitelistLimit) {
      return res.badRequest({
        error: i18n.translate('allowlist.sizelimit.exceeded', {
          defaultMessage: 'Allowlist limit of {whitelistLimit} reached.',
          values: { whitelistLimit },
          description: 'Allowlist limit exceeded.',
        }),
      });
    }

    // Add the rules to the global whitelist
    const createdItemIDs = await addWhitelistRule(context, newRules);
    if (createdItemIDs.length === 0) {
      return res.internalError({
        error: i18n.translate('allowlist.internalerror', {
          defaultMessage: 'Unable to create allowlist items',
        }),
      });
    } else {
      // Update the cache
      const cl = context.core.elasticsearch.dataClient.callAsCurrentUser;
      hydrateWhitelistCache(cl);

      // Dismiss Alerts that match these attributes
      if (req.body.dismiss) {
        await dismissAlerts(context, req.headers.host, newRules);
      }

      // Whitelist IDs are generated by ES, add them to each rule before returning
      let idx = 0;
      createdItemIDs.forEach((id: string) => {
        newRules[idx].id = id;
        idx++;
      });
      return res.ok({ body: newRules });
    }
  } catch (err) {
    return res.internalError({ body: err });
  }
}

async function getNumWhitelistRules(ctx): Promise<number> {
  const response = await ctx.core.elasticsearch.dataClient.callAsCurrentUser('cat.count', {
    index: whitelistIdx,
    h: 'count',
  });
  if (isNaN(Number(response))) {
    return -1;
  } else {
    return +response;
  }
}

/**
 * Dismisses alerts that match the given attributes
 * @param ctx App context
 * @param rules List of newly created whitelist rules
 */
async function dismissAlerts(ctx, host: string, rules: WhitelistRule[]) {
  const ruleAttributes: { [key: string]: string } = {};
  rules.forEach(r => {
    ruleAttributes[r.entry.apply_to] = r.entry.value;
  });
  const queryParams: string = querystring.stringify(ruleAttributes);

  // TODO where to find out protocol?
  request(`http://${host}/api/endpoint/alerts?${queryParams}`, function(error, response, body) {
    // TODO
  });
}

/**
 * Add a whitelist rule to the global whitelist
 * @param ctx App context
 * @param whitelistRules List of whitelist rules to apply
 */
async function addWhitelistRule(ctx, whitelistRules: WhitelistRule[]): Promise<string[]> {
  let body = '';
  whitelistRules.forEach(rule => {
    body = body.concat(`{ "index" : {}}\n ${JSON.stringify(rule)}\n`);
  });

  const response = await ctx.core.elasticsearch.dataClient.callAsCurrentUser('bulk', {
    index: whitelistIdx,
    refresh: 'true',
    body,
  });

  const errors: boolean = response.errors;
  if (errors) {
    // TODO log errors
  } else {
    // Responses from `bulk` are guaranteed to be in order https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-bulk.html
    return response.items.map(indexResponse => {
      return indexResponse.index._id;
    });
  }
  return [];
}

/**
 * Handles the GET request for whitelist retrieval
 */
async function handleWhitelistGet(context, req, res) {
  try {
    const cl: APICaller = context.core.elasticsearch.dataClient.callAsCurrentUser;
    const whitelist: WhitelistSet = await getWhitelist(cl);
    return res.ok({ body: whitelist });
  } catch (err) {
    return res.internalError({ body: err });
  }
}

/**
 * Retrieve the global whitelist
 * @param ctx App context
 */
async function getWhitelist(client: APICaller): Promise<WhitelistSet> {
  const response = (await client('search', {
    index: whitelistIdx,
    body: {},
    size: whitelistLimit,
  })) as SearchResponse<WhitelistRule>;

  const resp: WhitelistRule[] = [];
  response.hits.hits.forEach(hit => {
    const whitelist = hit._source;
    whitelist.id = hit._id;
    resp.push(whitelist);
  });

  return { entries: resp };
}

/**
 * Handles the GET request for whitelist manifest
 */
async function handleWhitelistManifest(context, req, res) {
  try {
    const manifest = await getWhitelistManifest(context);
    return res.ok({ body: manifest });
  } catch (err) {
    return res.internalError({ body: err });
  }
}

/**
 * Creates the manifest for the whitelist
 */
async function getWhitelistManifest(ctx) {
  if (whitelistArtifactCache.length === 0) {
    await hydrateWhitelistCache(ctx.core.elasticsearch.dataClient.callAsCurrentUser);
  }
  const hash = createHash('sha256')
    .update(whitelistArtifactCache.toString('utf8'), 'utf8')
    .digest('hex');

  const manifest = {
    schemaVersion: '1.0.0',
    manifestVersion: '1.0.0',
    artifacts: {
      'global-whitelist': {
        url: `${allowlistBaseRoute}/download/${hash}`,
        sha256: hash,
        size: whitelistArtifactCache.byteLength,
        encoding: 'xz',
      },
    },
  };
  return manifest;
}

/**
 * Compresses the whitelist and puts it into the in memory cache
 */
function cacheWhitelistArtifact(whitelist: WhitelistSet) {
  return new Promise(resolve =>
    lzma.compress(JSON.stringify(whitelist), (res: Buffer) => {
      whitelistArtifactCache = res;
      resolve();
    })
  );
}

/**
 * Hydrate the in memory whitelist cache
 */
async function hydrateWhitelistCache(client: APICaller) {
  const whitelist = await getWhitelist(client);
  await cacheWhitelistArtifact(whitelist);
}

/**
 * Handles the GET request for downloading the whitelist
 */
async function handleWhitelistDownload(context, req, res) {
  try {
    const whitelistHash: string = req.params.hash;
    const bufferHash = createHash('sha256')
      .update(whitelistArtifactCache.toString('utf8'), 'utf8')
      .digest('hex');
    if (whitelistHash !== bufferHash) {
      return res.badRequest({
        body: i18n.translate('allowlist.download.fail', {
          defaultMessage:
            'The requested artifact with hash {whitelistHash} does not match current hash of {bufferHash}',
          values: { whitelistHash, bufferHash },
          description: 'Allowlist download failure.',
        }),
      });
    }
    return res.ok({ body: whitelistArtifactCache, headers: { 'content-encoding': 'xz' } });
  } catch (err) {
    return res.internalError({ body: err });
  }
}

/**
 * Handles the DELETE request for removing a whitelist rule from the whitelist
 */
async function handleWhitelistItemDeletion(context, req, res) {
  try {
    const whitelistID: string = req.body.whitelist_id;
    return context.core.elasticsearch.dataClient
      .callAsCurrentUser('delete', {
        index: whitelistIdx,
        id: whitelistID,
        refresh: 'true',
      })
      .then(() => {
        return res.ok({
          body: i18n.translate('allowlist.delete.success', {
            defaultMessage: 'Successfully deleted {whitelistID}',
            values: { whitelistID },
            description: 'Allowlist delete success.',
          }),
        });
      })
      .catch((e: { status: number }) => {
        if (e.status === 404) {
          return res.badRequest({
            body: i18n.translate('allowlist.delete.fail', {
              defaultMessage: 'No item with id {whitelistID} in global allowlist',
              values: { whitelistID },
              description: 'Allowlist delete failure.',
            }),
          });
        } else {
          return res.internalError({});
        }
      });
  } catch (err) {
    return res.internalError({ body: err });
  }
}
