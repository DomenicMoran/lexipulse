import * as React from 'react';

/**
 * The complete icon set, drawn inline.
 *
 * Hairline strokes on a 24-unit grid, matching the 1 px borders of the rest of the
 * interface. Inline SVG keeps every glyph in the HTML payload: no icon font, no extra
 * request, and nothing that can arrive after the first paint and shift the layout.
 */
export type IconProps = React.SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const PlayIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M7 4.5v15l13-7.5-13-7.5Z" fill="currentColor" stroke="none" />
  </Icon>
);

export const PauseIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="6.5" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
    <rect x="13.5" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
  </Icon>
);

export const RewindIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M11 6 4 12l7 6V6Z" fill="currentColor" stroke="none" />
    <path d="M20 6l-7 6 7 6V6Z" fill="currentColor" stroke="none" />
  </Icon>
);

export const ForwardIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M13 6l7 6-7 6V6Z" fill="currentColor" stroke="none" />
    <path d="M4 6l7 6-7 6V6Z" fill="currentColor" stroke="none" />
  </Icon>
);

export const SettingsIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Icon>
);

export const KeyboardIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M8 14h8" />
  </Icon>
);

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const ChevronDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 9.5 12 15.5 18 9.5" />
  </Icon>
);

export const ChevronLeftIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M14.5 6 8.5 12l6 6" />
  </Icon>
);

export const ArrowRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4.5 12h15M13.5 6l6 6-6 6" />
  </Icon>
);

export const TrashIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 7h16M9.5 7V4.8A.8.8 0 0 1 10.3 4h3.4a.8.8 0 0 1 .8.8V7M6.5 7l.8 12.2a.8.8 0 0 0 .8.8h7.8a.8.8 0 0 0 .8-.8L17.5 7" />
  </Icon>
);

export const UploadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 15.5V4M8 8l4-4 4 4M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15" />
  </Icon>
);

export const DownloadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 4v11.5M8 11.5l4 4 4-4M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15" />
  </Icon>
);

export const LinkIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.2 1.2" />
    <path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.2-1.2" />
  </Icon>
);

export const TextIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 5h14M5 10h14M5 15h9M5 20h6" />
  </Icon>
);

export const LibraryIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 4.5h5a2 2 0 0 1 2 2V20a2 2 0 0 0-2-2H5V4.5ZM19 4.5h-5a2 2 0 0 0-2 2V20a2 2 0 0 1 2-2h5V4.5Z" />
  </Icon>
);

export const ChartIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 20h16M7.5 20V11M12 20V5M16.5 20v-6" />
  </Icon>
);

export const BookmarkIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6.5 4.5h11v15L12 15.5 6.5 19.5v-15Z" />
  </Icon>
);

export const SpeakerIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4.5 9.5h3l4-3.5v12l-4-3.5h-3v-5Z" />
    <path d="M15 9.5a3.5 3.5 0 0 1 0 5M17.5 7a7 7 0 0 1 0 10" />
  </Icon>
);

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4.5 12.5 9.5 17.5 19.5 7" />
  </Icon>
);

export const GithubIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M15 21v-3.2c0-1 -.3-1.7-.9-2.2 2.9-.3 5.4-1.4 5.4-6.1 0-1.3-.5-2.4-1.2-3.2.1-.3.5-1.5-.1-3.2 0 0-1-.3-3.2 1.2a11 11 0 0 0-5.9 0C6.8 2.8 5.8 3.1 5.8 3.1c-.6 1.7-.2 2.9-.1 3.2A4.6 4.6 0 0 0 4.5 9.5c0 4.7 2.5 5.8 5.4 6.1-.4.4-.7.9-.8 1.6-1.9.8-3.3-.8-3.8-1.6" />
  </Icon>
);

export const PulseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.5 12h4l2.5-6 4 12 2.5-6h6" />
  </Icon>
);
