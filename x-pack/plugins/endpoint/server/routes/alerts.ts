/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { schema } from '@kbn/config-schema';
import { IRouter } from 'kibana/server';
import { sleep } from '@elastic/eui';

export function alertsRoutes(router: IRouter) {
  router.get(
    {
      path: '/alerts',
      validate: {
        query: schema.object({
          pageSize: schema.number(),
          pageIndex: schema.number(),
          sortField: schema.maybe(schema.string()),
          sortDirection: schema.maybe(schema.string()),
        }),
      },
    },
    handleAlerts
  );

  router.get(
    {
      path: '/alerts/{id}',
      validate: {
        params: schema.object({
          id: schema.string(),
        }),
      },
    },
    handleAlertDetails
  );

  router.post(
    {
      path: '/alerts/archive',
      validate: {
        query: schema.object({
          alerts: schema.string(),
        }),
      },
    },
    handleArchive
  );
}

async function handleArchive(context, request, response) {
  // TODO: archive the alert
  const alerts = request.query.alerts;

  let elasticsearchResponse;
  alerts.split(',').forEach(async function(alertID: string) {
    try {
      elasticsearchResponse = await context.core.elasticsearch.dataClient.callAsCurrentUser(
        'update',
        {
          index: 'test_alert_data', // TODO
          id: alertID,
          body: { doc: { archived: true } },
          refresh: 'true',
        }
      );
    } catch (error) {
      return response.internalError();
    }
  });

  // TODO: This is a hack and needs to be refactored. ES is not refreshed in time when the frontend makes the request to fetch new data.
  await new Promise(resolve =>
    setTimeout(() => {
      resolve();
    }, 700)
  );

  return response.ok({
    body: JSON.stringify(elasticsearchResponse),
  });
}

async function handleAlertDetails(context, request, response) {
  let elasticsearchResponse;
  try {
    elasticsearchResponse = await context.core.elasticsearch.dataClient.callAsCurrentUser(
      'search',
      {
        body: {
          query: {
            bool: {
              must: [
                {
                  match: {
                    'event.kind': 'alert',
                  },
                },
                {
                  match: {
                    _id: request.params.id,
                  },
                },
              ],
            },
          },
        },
      }
    );
  } catch (error) {
    return response.internalError();
  }
  return response.ok({
    body: JSON.stringify({
      elasticsearchResponse,
    }),
  });
}

async function handleAlerts(context, request, response) {
  let elasticsearchResponse;
  try {
    function sortParams() {
      if (request.query.sortField && request.query.sortDirection) {
        return [
          {
            [request.query.sortField]: { order: request.query.sortDirection },
          },
        ];
      } else {
        return [];
      }
    }

    elasticsearchResponse = await context.core.elasticsearch.dataClient.callAsCurrentUser(
      'search',
      {
        body: {
          from: request.query.pageIndex * request.query.pageSize,
          size: request.query.pageSize,
          sort: sortParams(),
          query: {
            bool: {
              must: [{ term: { 'event.kind': 'alert' } }],
              must_not: [{ term: { archived: true } }],
            },
          },
        },
      }
    );
  } catch (error) {
    return response.internalError();
  }
  return response.ok({
    body: JSON.stringify({
      elasticsearchResponse,
    }),
  });
}
