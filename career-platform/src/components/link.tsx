import NextLink from "next/link";
import type { ComponentProps } from "react";

/**
 * next/link with automatic prefetch off. Every page here is dynamic and loads
 * the whole workspace from the database, so viewport prefetching fired a dozen
 * full renders per page view. In production that burst also raced with server
 * actions issued right after load and left their transitions pending.
 */
export default function Link({ prefetch = false, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={prefetch} {...props} />;
}
