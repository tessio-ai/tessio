// SPDX-License-Identifier: AGPL-3.0-only

export interface ExampleJobData {
  ticketId: string;
}

/** Pure job processor — kept free of the queue runtime so it is unit-testable. */
export function processExampleJob(data: ExampleJobData): { processed: string } {
  return { processed: data.ticketId };
}

export const EXAMPLE_QUEUE = 'example';
