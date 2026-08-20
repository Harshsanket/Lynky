/**
 * Blog motion constants + keyframe styles injected once on the page.
 */

export const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

export const MOTION_STYLES = `
  @keyframes lynky-flow {
    to { stroke-dashoffset: -16; }
  }

  @keyframes lynky-fade-up {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes lynky-pulse {
    0%, 100% {
      opacity: .18;
      transform: scale(.94);
    }
    50% {
      opacity: .42;
      transform: scale(1);
    }
  }

  .lynky-flow-line {
    animation: lynky-flow 1.3s linear infinite;
  }

  .lynky-fade-up {
    animation: lynky-fade-up .65s ${EASE} both;
  }

  .lynky-pulse {
    animation: lynky-pulse 2.5s ${EASE} infinite;
    transform-origin: center;
  }

  @media (prefers-reduced-motion: reduce) {
    .lynky-flow-line,
    .lynky-fade-up,
    .lynky-pulse {
      animation: none !important;
    }
  }
`;