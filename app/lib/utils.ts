import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// @see https://github.com/shadcn-ui/ui/discussions/2901#discussioncomment-10142712
export const scrollToBottom = (container: HTMLElement | null, smooth = false) => {
  if (container?.children.length) {
    const lastElement = container?.lastChild as HTMLElement

    lastElement?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      block: 'end',
      inline: 'nearest',
    })
  }
}
