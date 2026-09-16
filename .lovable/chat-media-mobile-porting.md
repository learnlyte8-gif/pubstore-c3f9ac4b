# Chat media attachments — mobile parity (Flutter + React Native)

Web reference implementation (already shipped):

- `src/lib/chatUpload.ts` — upload + signed-URL helper
- `src/components/chat/ChatMediaAttachment.tsx` — renders image / video / document bubbles
- `src/components/chat/AttachmentCard.tsx` — `ChatAttachment` union gained `image`, `video`, `file`
- `src/pages/Messages.tsx` — composer camera button (photos/videos) + paperclip button (documents)
- `src/components/chat/ShareToChatSheet.tsx` — preview labels for the new kinds

## 1. Data model (no migration needed)

Media rides on the existing `messages.attachment` jsonb column:

```json
{ "kind": "image" | "video" | "file",
  "path": "<userId>/<conversationId>/<timestamp>-<rand>-<filename>",
  "name": "invoice.pdf",
  "mime": "application/pdf",
  "size": 148213 }
```

`messages.body` carries a plain-text preview so conversation lists and push
notifications stay readable:

| kind  | body            |
| ----- | --------------- |
| image | `📷 Photo`      |
| video | `🎥 Video`      |
| file  | `📄 <filename>` |

**Never store a URL** — the bucket is private and signed URLs expire. Store the
storage path and sign on render.

## 2. Storage

Bucket `chat-media` (already exists, **private**). Policies on `storage.objects`:

- INSERT: `bucket_id = 'chat-media' AND owner = auth.uid()`
- SELECT: `bucket_id = 'chat-media'` (any signed-in user — chat peers must read)
- DELETE: `bucket_id = 'chat-media' AND owner = auth.uid()`

Path convention: `${userId}/${conversationId}/${Date.now()}-${rand}-${safeName}`
(`safeName` = filename with non `[\w.-]` chars replaced by `_`, last 60 chars).

Client-side limits enforced before upload (mirror them on mobile):

| kind     | limit  |
| -------- | ------ |
| image    | 15 MB  |
| video    | 100 MB |
| document | 25 MB  |

Kind detection: `mime.startsWith("image/")` → image, `video/` → video, else file.

## 3. Signed URLs

```
createSignedUrl(path, 60 * 60 * 24 * 7)  // 7 days
```

Cache signed URLs in memory keyed by path and re-sign when the cached entry is
within 60 s of expiry. Do not persist signed URLs to the database or local DB
rows — re-sign on render.

## 4. Send flow (identical on both platforms)

1. User picks file(s) — max 10 per action.
2. Validate size for the detected kind; show a toast and skip on failure.
3. Upload to `chat-media` with the path convention and the real content type.
4. Insert the message: `body` = preview label, `attachment` = the json above,
   `reply_to_id` = active reply (same as text messages).
5. Update `conversations.last_message` / `last_message_at` with the preview label
   (the web `insertMessage` helper already does this).
6. Insert the peer notification row exactly as text messages do
   (`type: "message"`, `conversation_id`, `link: "/messages"`).
7. Keep the optimistic bubble pattern: temp id inserted immediately, replaced by
   the returned row, removed on error.

Show a spinner on the attach button while uploading and disable both attach
buttons.

## 5. Render flow

- **image** — tap opens a full-screen viewer; bubble max width ~230 dp,
  max height ~320 dp, `cover` fit, placeholder while the URL resolves, broken
  image icon on failure.
- **video** — inline player with controls, `preload=metadata`, black background,
  same bubble bounds.
- **file** — row card: document icon, filename (1 line, ellipsis), human-readable
  size, download/open affordance. Tapping opens the signed URL in the OS viewer.

Reuse the existing bubble surfaces: mine = translucent white over the primary
bubble, theirs = card surface with border.

## 6. Flutter

Files to touch:

- `flutter/lib/models/message_models.dart` — `ChatAttachment` already generic
  (`kind` + `data`); no change needed, but add helpers `isMedia`, `path`, `name`,
  `size`.
- `flutter/lib/services/messages_service.dart` — add:
  - `Future<String?> uploadChatFile({required File file, required String conversationId})`
    using `supabase.storage.from('chat-media').upload(path, file, fileOptions: FileOptions(contentType: mime))`
  - `Future<String?> signedChatUrl(String path)` using
    `createSignedUrl(path, 604800)` with an in-memory `Map<String, ({String url, DateTime expires})>` cache
  - `sendMediaMessage(...)` that composes the preview label + attachment json and
    calls the existing insert path
- `flutter/lib/widgets/chat/attachment_card.dart` — the `image` case currently
  expects `d['url']`; change it to resolve `d['path']` through `signedChatUrl`
  (`FutureBuilder`), and add `video` (use `video_player` / `chewie`) and `file`
  cases.
- `flutter/lib/screens/thread_screen.dart` — composer: camera button →
  `image_picker` (`pickMultiImage`, `pickVideo`), paperclip button →
  `file_picker` (`FileType.custom`, extensions pdf/doc/docx/xls/xlsx/ppt/pptx/csv/txt/zip).

Dependencies to add in `flutter/pubspec.yaml`: `image_picker`, `file_picker`,
`video_player` (+ `chewie` if you want controls parity), `open_filex` for
documents, `mime` for content types.

## 7. React Native

Files to touch:

- `react-native/src/types.ts` — extend the message attachment type with the three
  new kinds.
- new `react-native/src/services/chatUpload.ts` — port of `src/lib/chatUpload.ts`.
  Upload with `expo-file-system` → `ArrayBuffer` (or `fetch(uri).then(r => r.blob())`
  where supported) since RN has no `File`.
- new `react-native/src/components/ChatMediaAttachment.tsx` — `Image`,
  `expo-av` `Video`, and a pressable file row (`Linking.openURL(signedUrl)`).
- `react-native/src/screens/ThreadScreen.tsx` — add the two attach buttons and
  the send flow; render `attachment` in `renderItem`.

Dependencies: `expo-image-picker`, `expo-document-picker`, `expo-av`,
`expo-file-system`.

## 8. Edge cases

- Session expired → upload fails with an RLS error; show
  "Upload blocked — sign in again and retry."
- Large video on cellular: show the size in the failure toast; do not silently
  compress.
- Multi-select: upload sequentially so each message keeps its own ordering.
- Deleted messages: leave the storage object (owner can delete later); rendering
  a missing object shows the broken-media placeholder.
- Group buy / supplier / DM conversations all use the same code path — no
  per-kind gating.

## 9. Test checklist

- Send a photo, a video, and a PDF in each conversation kind.
- Peer (different account) can open all three.
- Conversation list shows `📷 Photo` / `🎥 Video` / `📄 name.pdf` and the
  paperclip indicator.
- Push/in-app notification body matches the preview label.
- Reply-to a media message keeps the quoted preview.
- Reopen the app after a week → media still loads (URL re-signed).
- Oversized file is rejected with a clear message and no message row is created.
