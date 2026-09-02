/*
 * The animated character above the sign-in form.
 *
 * It is the one piece of motion on this screen, and it is not decoration: it tracks
 * what you are doing in the form. The eyes follow the caret as the email address grows,
 * and the paws come up over the eyes the moment focus lands in the password field — a
 * visible promise that nothing is watching what you type. Revealing the password drops
 * one paw, so the character peeks exactly when the field does.
 *
 * Palette only. The head and paws are `--foreground`, the ears, nose and jumper are
 * `--primary`, the eye whites are `--background`. No colour appears here that the rest
 * of the app does not already have.
 */

/** How far a pupil travels from centre, in user units. */
const PUPIL_TRAVEL = 4;

/** The swing that puts a paw over an eye. Mirrored for the right arm. */
const COVER_ANGLE = 155;

type LoginMascotProps = {
  /** Where the eyes look, -1 (left) to 1 (right). */
  look: number;
  /** True while the password field has focus and the password is hidden. */
  cover: boolean;
  /** True while the password is revealed — one eye comes out. */
  peek: boolean;
};

export function LoginMascot({ look, cover, peek }: LoginMascotProps) {
  const clamped = Math.max(-1, Math.min(1, look));
  const pupilX = clamped * PUPIL_TRAVEL;

  // Both paws cover while the password is hidden. Revealing it drops the left arm
  // back to rest, which is what makes the character look like it is peeking.
  const leftAngle = cover && !peek ? -COVER_ANGLE : 0;
  const rightAngle = cover ? COVER_ANGLE : 0;

  const arm = (angle: number, shoulderX: number) => ({
    transform: `rotate(${angle}deg)`,
    transformOrigin: `${shoulderX}px 112px`,
    transformBox: 'view-box' as const,
    transition: 'transform 420ms cubic-bezier(0.34, 1.32, 0.64, 1)',
  });

  return (
    <div className="flex justify-center" aria-hidden>
      <svg viewBox="0 0 200 168" className="h-32 w-40" role="presentation" focusable="false">
        {/* Jumper. Clipped by the bottom of the viewBox rather than drawn closed. */}
        <path
          d="M62 168 V132 a38 38 0 0 1 76 0 V168 Z"
          fill="var(--primary)"
        />

        {/* Head, ears first so they sit behind it. */}
        <g
          style={{
            transform: `rotate(${clamped * 2.5}deg)`,
            transformOrigin: '100px 96px',
            transformBox: 'view-box',
            transition: 'transform 260ms ease-out',
          }}
        >
          <circle cx="66" cy="40" r="15" fill="var(--primary)" />
          <circle cx="134" cy="40" r="15" fill="var(--primary)" />
          <circle cx="100" cy="72" r="46" fill="var(--foreground)" />

          {/* Eyes. The whites stay put; only the pupils travel. */}
          <circle cx="84" cy="68" r="12" fill="var(--background)" />
          <circle cx="116" cy="68" r="12" fill="var(--background)" />
          <g
            style={{
              transform: `translate(${pupilX}px, 1.5px)`,
              transition: 'transform 200ms ease-out',
            }}
          >
            <circle cx="84" cy="68" r="5.5" fill="var(--foreground)" />
            <circle cx="116" cy="68" r="5.5" fill="var(--foreground)" />
          </g>

          <ellipse cx="100" cy="92" rx="7" ry="5" fill="var(--primary)" />
          <path
            d="M92 100 q8 8 16 0"
            fill="none"
            stroke="var(--background)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>

        {/* Arms. Drawn hanging down and rotated up around the shoulder. */}
        <g style={arm(leftAngle, 62)}>
          <rect x="53" y="106" width="18" height="52" rx="9" fill="var(--foreground)" />
          <circle cx="62" cy="158" r="14" fill="var(--foreground)" />
        </g>
        <g style={arm(rightAngle, 138)}>
          <rect x="129" y="106" width="18" height="52" rx="9" fill="var(--foreground)" />
          <circle cx="138" cy="158" r="14" fill="var(--foreground)" />
        </g>
      </svg>
    </div>
  );
}
