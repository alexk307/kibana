/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { LegacyService } from './legacy_service';
import { LegacyConfig, LegacyServiceDiscoverPlugins, LegacyServiceSetupDeps } from './types';

type LegacyServiceMock = jest.Mocked<PublicMethodsOf<LegacyService> & { legacyId: symbol }>;

const createDiscoverPluginsMock = (): LegacyServiceDiscoverPlugins => ({
  pluginSpecs: [],
  uiExports: {
    savedObjectSchemas: {},
    savedObjectMappings: [],
    savedObjectMigrations: {},
    savedObjectValidations: {},
  },
  navLinks: [],
  pluginExtendedConfig: {
    get: jest.fn(),
    has: jest.fn(),
    set: jest.fn(),
  },
  disabledPluginSpecs: [],
  settings: {},
});

const createLegacyServiceMock = (): LegacyServiceMock => ({
  legacyId: Symbol(),
  discoverPlugins: jest.fn().mockResolvedValue(createDiscoverPluginsMock()),
  setup: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
});

const createLegacyConfigMock = (): jest.Mocked<LegacyConfig> => ({
  get: jest.fn(),
  has: jest.fn(),
  set: jest.fn(),
});

export const legacyServiceMock = {
  create: createLegacyServiceMock,
  createSetupContract: (deps: LegacyServiceSetupDeps) => createLegacyServiceMock().setup(deps),
  createDiscoverPlugins: createDiscoverPluginsMock,
  createLegacyConfig: createLegacyConfigMock,
};
