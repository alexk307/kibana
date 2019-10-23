/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { schema } from '@kbn/config-schema';
import { IRouter } from 'kibana/server';

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
  console.log(alerts)

  let elasticsearchResponse
  try {
    elasticsearchResponse = await context.core.elasticsearch.dataClient.callAsCurrentUser(
      'update',
      {
        index: "test_alert_data", // TODO
        id: alerts,
        body: {"doc": {"archived": true}},
      }
    );
  }
  catch (error) {
    return response.internalError();
  }


  return response.ok({
    body: JSON.stringify(elasticsearchResponse),
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
              must: [{term: {"event.kind": "alert"}}],
              must_not: [{term: {"archived": false}}],
            }
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
