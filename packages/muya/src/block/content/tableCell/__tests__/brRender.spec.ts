// @vitest-environment happy-dom

import type Content from '../../../base/content';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLASS_NAMES } from '../../../../config';
import { Muya } from '../../../../muya';

// Shift+Enter in a table cell stores a literal `<br/>` (GFM has no other
// in-cell line break). The htmlTag renderer used to keep that source in a
// visible `.mu-html-tag` span *and* emit a real `<br>`, so the tag leaked
// into the WYSIWYG cell. Hidden source + live `<br>` is the preview; the
// source comes back only while the caret sits on the token.

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length) {
        const host = bootedHosts.pop()!;
        host.remove();
    }
    document.getSelection()?.removeAllRanges();
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function tableCells(muya: Muya): Content[] {
    const out: Content[] = [];
    const visit = (block: {
        constructor: { blockName?: string };
        children?: { forEach: (cb: (b: unknown) => void) => void };
    }) => {
        if (block.constructor.blockName === 'table.cell.content')
            out.push(block as unknown as Content);
        block.children?.forEach(b => visit(b as typeof block));
    };
    visit(muya.editor.scrollPage as unknown as Parameters<typeof visit>[0]);
    return out;
}

describe('table cell <br/> preview', () => {
    it('hides the source tag and keeps a real line break when the caret is elsewhere', () => {
        const muya = bootMuya('| a<br/>b |\n| --- |\n| c |\n');
        const cell = tableCells(muya)[0]!;
        expect(cell.text).toBe('a<br/>b');

        const node = cell.domNode!;
        expect(node.querySelector('br')).toBeTruthy();
        expect(node.querySelector(`.${CLASS_NAMES.MU_HIDE}`)).toBeTruthy();
        expect(node.querySelector(`.${CLASS_NAMES.MU_HIDE}`)!.textContent).toBe('<br/>');
        expect(node.querySelector(`.${CLASS_NAMES.MU_HTML_TAG}`)).toBeNull();
        expect(muya.getMarkdown()).toContain('<br/>');
    });

    it('shows the source tag while the caret is on it so the user can edit it', () => {
        const muya = bootMuya('| a<br/>b |\n| --- |\n| c |\n');
        const cell = tableCells(muya)[0]!;
        muya.editor.activeContentBlock = cell;
        // Offset 1 is the `<` of `<br/>` in `a<br/>b`.
        cell.setCursor(1, 1, true);

        const node = cell.domNode!;
        expect(node.querySelector('br')).toBeTruthy();
        expect(node.querySelector(`.${CLASS_NAMES.MU_HTML_TAG}`)).toBeTruthy();
        expect(node.querySelector(`.${CLASS_NAMES.MU_HTML_TAG}`)!.textContent).toBe('<br/>');
    });
});
