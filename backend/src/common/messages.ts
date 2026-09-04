/**
 * Single source of truth for all API message strings (errors, success flags,
 * and human-readable labels). Change a message once here and it updates
 * everywhere. Modules import { MESSAGES } instead of inlining strings.
 */
export const MESSAGES = {
  AUTH: {
    EMAIL_EXISTS: 'An account with this email already exists',
    INVALID_CREDENTIALS: 'Invalid credentials',
    INVALID_REFRESH_TOKEN: 'Invalid or expired refresh token',
    USER_NOT_FOUND: 'User not found',
    GOOGLE_NO_EMAIL: 'Google account has no verified email',
    LOGOUT_SUCCESS: 'Logged out successfully',
  },
  BOARDS: {
    NOT_FOUND: 'Board not found',
    SECTION_NOT_FOUND: 'Section not found',
    ITEM_NOT_FOUND: 'Item not found',
    NEED_EDITOR_ACCESS: 'You need editor access to modify this board',
    OWNER_ONLY: 'Only the board owner can do this',
    SECTION_NOT_IN_BOARD: 'Section does not belong to this board',
    INVALID_REORDER: 'orderedItemIds must contain exactly the section items',
    USER_EMAIL_NOT_FOUND: 'No user with that email',
    ALREADY_OWNER: 'You already own this board',
    ALREADY_MEMBER: 'User is already a member of this board',
    CANNOT_CHANGE_OWNER_ROLE: 'Cannot change the owner role',
    CANNOT_REMOVE_OWNER: 'Cannot remove the board owner',
    DELETED: 'Board deleted',
  },
  PLACES: {
    SEARCH_FAILED: 'Places search failed',
  },
  COMMON: {
    UPDATED: 'Updated successfully',
    DELETED: 'Deleted successfully',
  },
} as const;

export type MessageKey = keyof typeof MESSAGES;
