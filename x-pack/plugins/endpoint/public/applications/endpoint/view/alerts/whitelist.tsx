/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { memo, useState, useMemo } from 'react';
import React, { Component } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import * as selectors from '../../store/whitelist/selectors';
import { EuiCheckboxGroup, EuiButton, } from '@elastic/eui';
import { WhitelistAction } from '../../store/whitelist/action';



export const WhitelistComponent = memo(() => {
    
    const dispatch: (action: WhitelistAction) => unknown = useDispatch();
    const whitelistAttributes = useSelector(selectors.whitelistSelector);

    const idMap = useMemo(()=>{
        const ret: Record<string, boolean> = {};
        for(const attr of whitelistAttributes){
            ret[attr] = true;
        }
        return ret;
    }, [whitelistAttributes]);

    const options = [
        {
          id: '0',
          label: 'Option one',
          'data-test-sub': 'dts_test',
        },
        {
          id: '1',
          label: 'Option two is checked by default',
          className: 'classNameTest',
        },
        {
          id: '2',
          label: 'Option three is disabled',
        },
      ];



    const onChange = (optionID: string) => {
        dispatch({
            'type': 'whitelistAttributeSelected',
            'payload': optionID,
        });
    };

    const submitWhitelistForm = () => {
        // TODO fun shit here
    }

  return (
    <>
    <EuiCheckboxGroup
          options={options}
          idToSelectedMap={idMap}
          onChange={onChange}
    />

    <EuiButton onClick={submitWhitelistForm}>
          Submit
    </EuiButton>
    </>
  );
});