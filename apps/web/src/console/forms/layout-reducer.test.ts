// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { addSection, renameSection, removeSection, addField, removeField, setFieldProps, moveField, moveSection } from './layout-reducer';
import type { FormDefinition } from '@tessio/shared';

const base: FormDefinition = { sections: [{ id: 's1', title: 'About', order: 0, fields: [{ fieldKey: 'title', width: 'full' }] }] };

describe('layout-reducer', () => {
  it('addSection appends a normalized section', () => {
    const d = addSection(base, 'More');
    expect(d.sections).toHaveLength(2);
    expect(d.sections[1]).toMatchObject({ title: 'More', order: 1, fields: [] });
  });

  it('renameSection / removeSection', () => {
    expect(renameSection(base, 's1', 'X').sections[0].title).toBe('X');
    expect(removeSection(base, 's1').sections).toHaveLength(0);
  });

  it('addField adds a ref; removeField removes it', () => {
    const d = addField(base, 's1', 'urgency');
    expect(d.sections[0].fields.map((f) => f.fieldKey)).toEqual(['title', 'urgency']);
    expect(removeField(d, 's1', 'urgency').sections[0].fields.map((f) => f.fieldKey)).toEqual(['title']);
  });

  it('addField is a no-op if the field is already placed anywhere', () => {
    expect(addField(base, 's1', 'title').sections[0].fields).toHaveLength(1);
  });

  it('setFieldProps patches presentation', () => {
    const d = setFieldProps(base, 's1', 'title', { width: 'half', placeholder: 'Summary', requiredAtIntake: true });
    expect(d.sections[0].fields[0]).toMatchObject({ width: 'half', placeholder: 'Summary', requiredAtIntake: true });
  });

  it('moveField reorders within a section', () => {
    const two = addField(base, 's1', 'urgency');
    const d = moveField(two, 's1', 's1', 1, 0);
    expect(d.sections[0].fields.map((f) => f.fieldKey)).toEqual(['urgency', 'title']);
  });

  it('moveField moves between sections', () => {
    const d0 = addSection(base, 'More');
    const d = moveField(d0, 's1', d0.sections[1].id, 0, 0);
    expect(d.sections[0].fields).toHaveLength(0);
    expect(d.sections[1].fields.map((f) => f.fieldKey)).toEqual(['title']);
  });

  it('moveSection reorders and renormalizes order', () => {
    const d0 = addSection(base, 'More');
    const d = moveSection(d0, 1, 0);
    expect(d.sections.map((s) => s.title)).toEqual(['More', 'About']);
    expect(d.sections.map((s) => s.order)).toEqual([0, 1]);
  });
});
