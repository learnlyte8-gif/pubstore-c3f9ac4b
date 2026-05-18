# Social layer — full build

Turn the marketplace into a social commerce app: users follow users + suppliers, like and share products/catalogs/suppliers, chat 1:1 and in private group-buy rooms, with a personalized "For You" feed and a tabbed Messages inbox.

## 1. Database (one migration)

New tables, all with RLS:

- **`user_follows`** — `follower_id`, `followee_id` (both → auth.users). Unique pair. Users can follow/unfollow themselves; everyone can read.
- **`post_likes`** — generic likes: `user_id`, `target_type` (`product` | `supplier` | `catalog` | `post`), `target_id`. Unique per (user, target). Public read.
- **`shares`** — log of shares: `user_id`, `target_type`, `target_id`, `channel` (`chat` | `external` | `copy`), optional `conversation_id`. Used for ranking signal.
- **`group_buys`** — `id`, `owner_id`, `product_id`, `supplier_id`, `title`, `target_qty`, `deadline`, `status` (`open` | `locked` | `fulfilled` | `cancelled`), `conversation_id` (the group chat).
- **`group_buy_members`** — `group_id`, `user_id`, `qty`, `role` (`owner` | `member` | `invited`), `joined_at`. RLS: members see their groups; owner can invite/remove.
- **`group_buy_invites`** — `group_id`, `inviter_id`, `invitee_id`, `status` (`pending` | `accepted` | `declined`). Notifies invitee.

Extend existing `conversations`:
- Add `kind` (`buyer_supplier` | `dm` | `group_buy`), `peer_user_id` (for DMs), `group_buy_id` nullable.
- Add `members` join table `conversation_members(conversation_id, user_id)` for group chats (RLS: members read/write).

Triggers:
- Notify followee on new follow.
- Notify product owner on like (rate-limited; skip self-likes).
- Notify invitee on group-buy invite, owner on accept, supplier when `target_qty` reached → flip status to `locked`.
- Auto-create group-chat conversation when a `group_buys` row is inserted.

## 2. Feed ranking ("For You")

Pure SQL view + client blend, no ML. Score per product:

```text
score =
    0.45 * recency_decay(created_at, half_life=72h)
  + 0.20 * interest_match(user_interests, product.category)
  + 0.15 * follow_boost(is_following_supplier_or_owner)
  + 0.10 * social_proof(log(likes + 2*shares + 3*orders))
  + 0.10 * personal_affinity(past_likes/views in same category)
```

Implemented as a `personalized_feed(user_id, limit)` SQL function returning ranked product IDs. `Home.tsx` For-You rail calls it; falls back to recency when signed-out. `Following` rail stays as-is but now includes followed users' liked/shared items too.

## 3. UI surfaces

- **Product card / supplier card / catalog card**: add Like (heart, optimistic), Share-to-chat button → opens existing `ShareToChatSheet` extended with friend list + group list.
- **User profile page** `/u/:userId`: avatar, bio, follow button, follower/following counts, tabs (Likes, Shares, Groups public-only).
- **Follow button** component (works for users and suppliers via a single hook `useFollow(targetType, targetId)`).
- **Group-buy entry point** on `ProductDetail`: "Buy together" → opens a sheet to set target qty + deadline, pick invitees from followed users, creates `group_buys` row + chat.
- **Group-buy chat**: standard messages thread, plus pinned header showing pooled qty / target / deadline / status, "Invite more" and "Leave" actions.
- **Messages page**: tab bar `Unread | Suppliers | People | Groups`. Filter conversations by `kind` and unread count from `useUnreadChats`. Unread tab badges in nav.

## 4. Sharing

Extend `ShareToChatSheet`:
- Recipient picker: followed users + existing chats + group-buy rooms.
- Payload supports product / supplier / catalog / group-buy invite via `AttachmentCard`.
- Records a `shares` row for ranking.

## 5. Notifications

New types wired into existing `notifications` table + push:
`user_followed_you`, `post_liked`, `share_received`, `group_buy_invite`, `group_buy_joined`, `group_buy_locked`.

## Technical notes

- All new tables use `auth.uid()` RLS; group-chat membership checked via `conversation_members` with a `SECURITY DEFINER` `is_conversation_member(uid, cid)` to avoid recursion.
- Realtime: add `user_follows`, `post_likes`, `group_buys`, `group_buy_members`, `conversation_members` to `supabase_realtime`.
- Client hooks: `useFollow`, `useLike`, `useShare`, `useGroupBuy(id)`, `useGroupBuyInbox`, `usePersonalizedFeed`.
- `LiveActivityToaster` gets two new toasts: someone followed you / invited you to a group buy.
- Unread tab counts reuse `useUnreadChats`; per-tab unread derived by joining `perConversation` with conversation `kind`.

## Out of scope (call out before building)

- No public group-buy pools (you picked invite-only).
- No comments under products yet — likes + share + chat only.
- No stories/posts entity beyond what the catalog already provides.

Ship in this order: migration → hooks → like/share/follow buttons everywhere → user profile page → group-buy flow → Messages tabs → personalized feed swap-in.
