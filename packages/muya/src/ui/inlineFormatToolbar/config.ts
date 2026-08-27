import codeIcon from '../../assets/icons/code/2.png';
import clearIcon from '../../assets/icons/format_clear/2.png';
import emphasisIcon from '../../assets/icons/format_emphasis/2.png';
import imageIcon from '../../assets/icons/format_image/2.png';
import linkIcon from '../../assets/icons/format_link/2.png';
import mathIcon from '../../assets/icons/format_math/2.png';
import strikeIcon from '../../assets/icons/format_strike/2.png';
import strongIcon from '../../assets/icons/format_strong/2.png';
import underlineIcon from '../../assets/icons/format_underline/2.png';
import highlightIcon from '../../assets/icons/highlight/2.png';
import { isOsx, isWin } from '../../config';

const COMMAND_KEY = isOsx ? '⌘' : 'Ctrl';

const commentShortcut = (): string => {
    if (isOsx)
        return '⌘+Alt+M';
    if (isWin)
        return 'Ctrl+Alt+M';
    return 'Ctrl+Shift+Alt+M';
};

export interface FormatToolIcon {
    type: string;
    tooltip: string;
    shortcut: string;
    icon?: string;
    glyph?: string;
}

const icons: FormatToolIcon[] = [
    {
        type: 'strong',
        tooltip: 'Emphasize',
        shortcut: `${COMMAND_KEY}+B`,
        icon: strongIcon,
    },
    {
        type: 'em',
        tooltip: 'Italic',
        shortcut: `${COMMAND_KEY}+I`,
        icon: emphasisIcon,
    },
    {
        type: 'u',
        tooltip: 'Underline',
        shortcut: `${COMMAND_KEY}+U`,
        icon: underlineIcon,
    },
    {
        type: 'del',
        tooltip: 'Strikethrough',
        shortcut: `${COMMAND_KEY}+D`,
        icon: strikeIcon,
    },
    {
        type: 'mark',
        tooltip: 'Highlight',
        shortcut: `⇧+${COMMAND_KEY}+H`,
        icon: highlightIcon,
    },
    {
        type: 'inline_code',
        tooltip: 'Inline Code',
        // Default keybinding is Cmd/Ctrl+` (Linux uses Ctrl+Y); was wrongly +E.
        shortcut: `${COMMAND_KEY}+\``,
        icon: codeIcon,
    },
    {
        type: 'inline_math',
        tooltip: 'Inline Math',
        // Default keybinding is Shift+Cmd/Ctrl+M; was wrongly +E.
        shortcut: `⇧+${COMMAND_KEY}+M`,
        icon: mathIcon,
    },
    {
        type: 'link',
        tooltip: 'Link',
        shortcut: `${COMMAND_KEY}+L`,
        icon: linkIcon,
    },
    {
        type: 'image',
        tooltip: 'Image',
        shortcut: `⇧+${COMMAND_KEY}+I`,
        icon: imageIcon,
    },
    {
        type: 'clear',
        tooltip: 'Eliminate',
        shortcut: `⇧+${COMMAND_KEY}+R`,
        icon: clearIcon,
    },
    {
        type: 'comment',
        tooltip: 'New Comment',
        shortcut: commentShortcut(),
        // Silhouette mask (`i.icon-inner` + drop-shadow) tints PNGs with
        // currentcolor, so a full-color bubble never shows. Use the emoji glyph.
        glyph: '💬',
    },
];

export default icons;
