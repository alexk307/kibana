/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import React from 'react';
import { renderWithIntl, shallowWithIntl } from 'test_utils/enzyme_helpers';
import { ShowLicenseInfo } from '../license_info';

describe('ShowLicenseInfo', () => {
  it('shallow renders without errors', () => {
    const wrapper = shallowWithIntl(<ShowLicenseInfo />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders without errors', () => {
    const wrapper = renderWithIntl(<ShowLicenseInfo />);
    expect(wrapper).toMatchSnapshot();
  });
});
