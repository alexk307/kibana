/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import { KibanaRequest, RequestHandler } from 'kibana/server';
import { SearchResponse } from 'elasticsearch';
import { AlertData } from '../../../../common/types';
import { EndpointAppContext } from '../../../types';
import { getRequestData, buildAlertListESQuery, mapToAlertResultList } from './lib';
import { AlertListRequestParams } from './types';

export const alertListHandlerWrapper = function(
  endpointAppContext: EndpointAppContext
): RequestHandler<unknown, AlertListRequestParams, AlertListRequestParams> {
  const alertListHandler: RequestHandler<
    unknown,
    AlertListRequestParams,
    AlertListRequestParams
  > = async (
    ctx,
    req: KibanaRequest<unknown, AlertListRequestParams, AlertListRequestParams>,
    res
  ) => {
    try {
      const reqData = await getRequestData(req, endpointAppContext);

      const reqWrapper = await buildAlertListESQuery(reqData);
      endpointAppContext.logFactory.get('alerts').debug('ES query: ' + JSON.stringify(reqWrapper));

      const response = (await ctx.core.elasticsearch.dataClient.callAsCurrentUser(
        'search',
        reqWrapper
      )) as SearchResponse<AlertData>;

      return res.ok({ body: mapToAlertResultList(endpointAppContext, reqData, response) });
    } catch (err) {
      return res.internalError({ body: err });
    }
  };

  return alertListHandler;
};
