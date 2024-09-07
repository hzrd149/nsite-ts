import { multiServerUpload, BlossomClient } from "blossom-client-sdk";
import { SimplePool } from "nostr-tools";

const logContainer = document.getElementById("log");
function log(...args) {
  const el = document.createElement("div");
  el.innerText = args.join(" ");
  logContainer.appendChild(el);
}

const uploadButton = document.getElementById("upload-button");

/** @type {HTMLInputElement} */
const filesInput = document.getElementById("files");

/**
 * @param {FileSystemFileEntry} fileEntry
 * @returns {File}
 */
export function readFileSystemFile(fileEntry) {
  return new Promise((res, rej) => {
    fileEntry.file(
      (file) => res(file),
      (err) => rej(err),
    );
  });
}

/**
 * @param {FileSystemDirectoryEntry} directory
 * @returns {FileSystemEntry[]}
 */
export function readFileSystemDirectory(directory) {
  return new Promise((res, rej) => {
    directory.createReader().readEntries(
      (entries) => res(entries),
      (err) => rej(err),
    );
  });
}

/**
 * uploads a file system entry to blossom servers
 * @param {FileSystemEntry} entry
 * @returns {{file: File, path: string, sha256: string}[]}
 */
async function readFileSystemEntry(entry) {
  const files = [];
  if (entry instanceof FileSystemFileEntry && entry.isFile) {
    try {
      const file = await readFileSystemFile(entry);
      const sha256 = await BlossomClient.getFileSha256(file);
      const path = entry.fullPath;

      files.push({ file, path, sha256 });
    } catch (e) {
      log("Failed to add" + entry.fullPath);
      log(e.message);
    }
  } else if (entry instanceof FileSystemDirectoryEntry && entry.isDirectory) {
    const entries = await readFileSystemDirectory(entry);
    for (const e of entries) files.push(...(await readFileSystemEntry(e)));
  }

  return files;
}

/**
 * uploads a file system entry to blossom servers
 * @param {FileList} list
 * @returns {{file: File, path: string, sha256: string}[]}
 */
async function readFileList(list) {
  const files = [];
  for (const file of list) {
    const path = file.webkitRelativePath ? file.webkitRelativePath : file.name;
    const sha256 = await BlossomClient.getFileSha256(file);
    files.push({ file, path, sha256 });
  }
  return files;
}

const pool = new SimplePool();

/**
 * uploads a file system entry to blossom servers
 * @param {{file:File, path:string}} files
 * @param {import("blossom-client-sdk").Signer} signer
 * @param {*} auth
 * @param {string[]} servers
 * @param {string[]} relays
 */
async function uploadFiles(files, signer, auth, servers, relays) {
  for (const { file, path, sha256 } of files) {
    try {
      const upload = multiServerUpload(servers, file, signer, auth);

      let published = false;
      for await (let { blob } of upload) {
        if (!published) {
          const signed = await signer({
            kind: 34128,
            content: "",
            created_at: Math.round(Date.now() / 1000),
            tags: [
              ["d", path],
              ["x", sha256],
            ],
          });
          await pool.publish(relays, signed);

          log("Published", path, sha256, signed.id);
        }
      }
    } catch (error) {
      log(`Failed to upload ${path}`, error);
    }
  }
}

uploadButton.addEventListener("click", async () => {
  if (!window.nostr) return alert("Missing NIP-07 signer");

  const signer = (draft) => window.nostr.signEvent(draft);
  const relays = document.getElementById("relays").value.split(/\n|,/);
  const servers = document.getElementById("servers").value.split(/\n|,/);

  try {
    if (filesInput.files) {
      const files = await readFileList(filesInput.files);

      // strip leading dir
      for (const file of files) file.path = file.path.replace(/^[^\/]+\//, "/");

      log(`Found ${files.length} files`);

      await uploadFiles(files, signer, undefined, servers, relays);
    }
  } catch (error) {
    alert(`Failed to upload files: ${error.message}`);
  }
});
