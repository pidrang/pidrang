export interface PagesBundleSource {
  target: string;
  source: string;
  format?: (source: string) => string;
}
