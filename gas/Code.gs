/**
 * 食事写真記録 バックアップ用ウェブアプリ
 *
 * デプロイ設定:
 *   種類: ウェブアプリ
 *   次のユーザーとして実行: 自分
 *   アクセスできるユーザー: 全員
 *
 * 写真はマイドライブ直下の FOLDER_NAME フォルダに保存する。
 */
const FOLDER_NAME = '食事写真記録';
const LIST_PAGE_SIZE = 500;

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    return respond(handle(body));
  } catch (err) {
    return respond({ error: String((err && err.message) || err) });
  }
}

function handle(body) {
  switch (body.action) {
    case 'ping':
      return { ok: true, folder: getFolder().getName() };
    case 'upload':
      return upload(body.name, body.data);
    case 'list':
      return list(body.pageToken);
    case 'download':
      return { data: Utilities.base64Encode(DriveApp.getFileById(body.id).getBlob().getBytes()) };
    case 'delete':
      try {
        DriveApp.getFileById(body.id).setTrashed(true);
      } catch (err) {
        // 既に無いファイルは削除済み扱い
      }
      return { ok: true };
    default:
      throw new Error('unknown action: ' + body.action);
  }
}

function getFolder() {
  const root = DriveApp.getRootFolder();
  const it = root.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : root.createFolder(FOLDER_NAME);
}

/** 同名ファイルがあれば作らずそのIDを返す（送信の二重実行対策） */
function upload(name, data) {
  const folder = getFolder();
  const existing = folder.getFilesByName(name);
  if (existing.hasNext()) {
    return { id: existing.next().getId() };
  }
  const blob = Utilities.newBlob(Utilities.base64Decode(data), 'image/jpeg', name);
  return { id: folder.createFile(blob).getId() };
}

function list(pageToken) {
  const it = pageToken ? DriveApp.continueFileIterator(pageToken) : getFolder().getFiles();
  const files = [];
  while (it.hasNext() && files.length < LIST_PAGE_SIZE) {
    const f = it.next();
    if (!f.isTrashed()) {
      files.push({ id: f.getId(), name: f.getName() });
    }
  }
  return { files: files, nextPageToken: it.hasNext() ? it.getContinuationToken() : null };
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
