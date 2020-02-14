/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { Reducer } from 'redux';
import { WhitelistState } from '../../../../../common/types'
import { AppAction } from '../action';

const initialState = (): WhitelistState => {
  return {
    selectedAttributes: new Set()
  };
};

export const whitelistReducer: Reducer<WhitelistState, AppAction> = (
  state = initialState(),
  action
) => {
  if (action.type === 'whitelistAttributeSelected') {
      const newSet = new Set([...state.selectedAttributes]);
      if (newSet.has(action.payload)) {
        newSet.delete(action.payload);
      } else {
          newSet.add(action.payload);
      }
      const ret_val: WhitelistState = {
        ...state,
        selectedAttributes: newSet,
      };
      console.log(ret_val);
    return ret_val
  }
  return state;
};
