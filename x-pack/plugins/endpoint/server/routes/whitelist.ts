/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { IRouter } from 'kibana/server';
import { schema } from '@kbn/config-schema';
import { EndpointAppContext } from '../types';

export function registerWhitelistRoutes(router: IRouter, endpointAppContext: EndpointAppContext) {

  router.get(
    {
      path: '/api/endpoint/whitelist',
      validate: {      },
      options: { authRequired: true },
    },
    handleWhitelistGet
  );

  const INVALID_UUID = "`alert_id` Must be a UUID.'"
  router.post(
    {
      path: '/api/endpoint/whitelist',
      validate: {
          body: schema.object({
              comment: schema.maybe(schema.string()),  // Optional comment explaining reason for whitelist
              alert_id: schema.string({
                  minLength: 36,  // https://tools.ietf.org/html/rfc4122#section-3
                  maxLength: 36,
                  validate(value) {  // Must be a UUID
                    if (!validateUUID(value)) {
                        return INVALID_UUID;
                    }
                  }
            }),
            file_path: schema.maybe(schema.string()),
            signer: schema.maybe(schema.string()),
            sha_256: schema.maybe(schema.string()),
            dismiss: schema.boolean({defaultValue: false})  // Boolean determining if we dismiss all alerts that match this
          })
        },
      options: { authRequired: false }, // Change me
    },
    handleWhitelistPost
  );
}


async function handleWhitelistPost(context, req, res) {
    try {
        // TODO check if one of whitelist fields exists
        
      return res.ok({ body: req.body});
      
    } catch (err) {
      return res.internalError({ body: err });
    }
  }

async function handleWhitelistGet(context, req, res) {
try {
    return res.ok({ body: "ok"});
    
} catch (err) {
    return res.internalError({ body: err });
}
}


function validateUUID(str: string): boolean {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str)
}