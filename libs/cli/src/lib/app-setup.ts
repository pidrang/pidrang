export interface SetupImport {
  name: string;
  from: string;
}

export interface SetupConstant {
  name: string;
  initializer: string;
}

export interface SetupProperty {
  name: string;
  value: string;
}

export interface EnvironmentEntry {
  name: string;
  value: string;
  hint?: string;
}

export interface AppSetup {
  imports: SetupImport[];
  constants: SetupConstant[];
  pidrangConfig: SetupProperty[];
  environment: EnvironmentEntry[];
  notes: string[];
}
