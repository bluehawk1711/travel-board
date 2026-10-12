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
    GOOGLE_ID_TOKEN_INVALID: 'Invalid Google sign-in token',
    GOOGLE_ID_TOKEN_EXPIRED: 'Google sign-in session expired — try again',
    LOGOUT_SUCCESS: 'Logged out successfully',
    INVALID_RESET_TOKEN: 'Invalid or expired reset token',
    PASSWORD_RESET_EMAIL_SENT:
      'If an account exists with this email, a password reset link has been sent',
    PASSWORD_RESET_SUCCESS: 'Password has been reset successfully',
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
  COMMENTS: {
    NOT_FOUND: 'Comment not found',
    EMPTY_BODY: 'Comment cannot be empty',
    NOT_AUTHOR: 'You can only delete your own comments',
  },
  FOLLOWS: {
    SELF_FOLLOW: 'You cannot follow yourself',
    UNFOLLOW_SELF: 'You cannot unfollow yourself',
  },
  CHAT: {
    CONVERSATION_NOT_FOUND: 'Conversation not found',
    NOT_A_MEMBER: 'You are not a member of this conversation',
    SELF_DM: 'You cannot start a conversation with yourself',
    EMPTY_MESSAGE: 'Message cannot be empty',
    GROUP_MEMBERS_REQUIRED:
      'A group conversation needs at least one other member',
    TOO_MANY_MEMBERS: 'Group conversations are limited to 50 members',
    NOT_BOARD_MEMBER: 'Only board members can access this board chat',
    USER_NOT_FOUND: 'User not found',
    DIRECT_USER_REQUIRED: 'A direct conversation needs a user to message',
  },
  UPLOADS: {
    NO_FILE: 'No file was uploaded',
    INVALID_TYPE: 'Only JPEG, PNG, WebP and GIF images are allowed',
    TOO_LARGE: 'Image exceeds the 5MB limit',
  },
  SETTINGS: {
    NOT_FOUND: 'Settings not found',
    UPDATED: 'Settings updated successfully',
    INVALID_CURRENCY: 'Unsupported currency code',
  },
  PUSH: {
    TOKEN_REGISTERED: 'Push token registered',
    TOKEN_REMOVED: 'Push token removed',
  },
  NOTIFICATIONS: {
    READ: 'Notifications marked as read',
  },
  COMMON: {
    UPDATED: 'Updated successfully',
    DELETED: 'Deleted successfully',
  },
} as const;

export type MessageKey = keyof typeof MESSAGES;
