/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { AlertListState } from '../../types';

export const alertListData = (state: AlertListState) => state.alerts;
export const alertDetailsClick = (state: AlertListState) => state.alertDetailsClick;
export const alertDetailsClose = (state: AlertListState) => state.alertDetailsClose;
