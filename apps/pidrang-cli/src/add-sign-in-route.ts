import {
  SIGN_IN_ROUTE_SNIPPET,
  generateResourceRoutesFile,
} from '@pidrang/cli';
import { FileEdit, PIDRANG_COMMENT, commentBlock } from './edit-app-config';
import { findTakenRoutes } from './preflight-app';
import { recognizeResourceRoutes } from './recognize-resource-routes';
import { stripLeadingLines } from './text-edit';

const MANUAL_STEPS = [
  'pidrang could not edit this file safely. Make this change by hand, then delete these pidrang lines.',
  'Add this route to resourceRoutes, above the :resource routes:',
  ...SIGN_IN_ROUTE_SNIPPET.trimEnd().split('\n'),
];

export function addSignInRoute(source: string): FileEdit {
  const recognized = recognizeResourceRoutes(source);
  if (recognized?.signIn === true) {
    return { kind: 'unchanged' };
  }
  if (recognized !== null) {
    return {
      kind: 'edited',
      content: generateResourceRoutesFile(true, recognized.guards).content,
    };
  }
  const rest = stripLeadingLines(source, PIDRANG_COMMENT);
  if (findTakenRoutes(rest).includes('sign-in')) {
    return { kind: 'unchanged' };
  }
  const content = `${commentBlock(PIDRANG_COMMENT, MANUAL_STEPS)}\n${rest}`;
  return content === source
    ? { kind: 'unchanged' }
    : {
        kind: 'manual',
        content,
        reason: 'it is not the file pidrang init writes',
      };
}
