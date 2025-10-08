import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ExportPost {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  announcement: boolean;
  contentWarning: string | null;
  author: {
    id: string;
    name: string;
    username: string;
    profilePictureUrl: string | null;
  };
  images: Array<{
    id: string;
    url: string;
    width: number;
    height: number;
    filename: string;
  }>;
  reactions: Array<{
    emoji: string;
    user: {
      id: string;
      username: string;
      name: string;
    };
  }>;
  depth: number;
  inReplyToId: string | null;
  replies: ExportPost[];
}

interface ExportDirectMessage {
  id: string;
  content: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    username: string;
    profilePictureUrl?: string | null;
  };
  receiver: {
    id: string;
    name: string;
    username: string;
    profilePictureUrl?: string | null;
  };
  reactions: Array<{
    emoji: string;
    user: {
      id: string;
      username: string;
      name: string;
    };
  }>;
}

interface ExportGroupMessage {
  id: string;
  content: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    username: string;
    profilePictureUrl?: string | null;
  };
  reactions: Array<{
    emoji: string;
    user: {
      id: string;
      username: string;
      name: string;
    };
  }>;
}

interface ExportGroupChat {
  id: string;
  name: string;
  createdAt: string;
  messages: ExportGroupMessage[];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function generatePostsHTML(
  communityName: string,
  posts: ExportPost[],
  exportDate: string,
): Promise<string> {
  const renderPost = (post: ExportPost, isReply = false): string => {
    const reactionSummary =
      post.reactions.length > 0
        ? `<div class="reactions">
          ${post.reactions
            .reduce(
              (acc, r) => {
                const existing = acc.find((item) => item.emoji === r.emoji);
                if (existing) {
                  existing.count++;
                  existing.users.push(r.user.name);
                } else {
                  acc.push({ emoji: r.emoji, count: 1, users: [r.user.name] });
                }
                return acc;
              },
              [] as Array<{ emoji: string; count: number; users: string[] }>,
            )
            .map(
              (r) =>
                `<span class="reaction" title="${escapeHtml(r.users.join(", "))}">${escapeHtml(r.emoji)} ${r.count}</span>`,
            )
            .join("")}
        </div>`
        : "";

    const imageGallery =
      post.images.length > 0
        ? `<div class="image-gallery">
          ${post.images.map((img) => `<img src="images/${escapeHtml(img.url.split("/").pop() || "")}" alt="${escapeHtml(img.filename)}" loading="lazy" />`).join("")}
        </div>`
        : "";

    const contentWarningBadge = post.contentWarning
      ? `<div class="content-warning">⚠️ ${escapeHtml(post.contentWarning)}</div>`
      : "";

    const announcementBadge = post.announcement
      ? `<span class="badge announcement">📢 공지</span>`
      : "";

    const repliesHtml =
      post.replies.length > 0
        ? `<div class="replies">
          ${post.replies.map((reply) => renderPost(reply, true)).join("")}
        </div>`
        : "";

    const profilePicture = post.author.profilePictureUrl
      ? `<img src="images/${escapeHtml(post.author.profilePictureUrl.split("/").pop() || "")}" alt="${escapeHtml(post.author.name)}" class="profile-picture" />`
      : `<div class="profile-picture-placeholder">${escapeHtml(post.author.name.charAt(0).toUpperCase())}</div>`;

    return `
      <div class="post ${isReply ? "reply" : "root-post"}" style="margin-left: ${post.depth * 20}px;">
        <div class="post-header">
          <div class="author-info">
            ${profilePicture}
            <div class="author-text">
              <strong>${escapeHtml(post.author.name)}</strong>
              <span class="username">@${escapeHtml(post.author.username)}</span>
            </div>
          </div>
          <div class="post-meta">
            ${announcementBadge}
            <span class="timestamp">${formatDate(post.createdAt)}</span>
          </div>
        </div>
        ${contentWarningBadge}
        <div class="post-content">${escapeHtml(post.content)}</div>
        ${imageGallery}
        ${reactionSummary}
        ${repliesHtml}
      </div>
    `;
  };

  const template = await readFile(
    join(__dirname, "..", "templates", "post.html"),
    "utf-8",
  );

  const postsContent = posts.map((post) => renderPost(post)).join("");

  return template
    .replace(/\{\{COMMUNITY_NAME\}\}/g, escapeHtml(communityName))
    .replace(/\{\{EXPORT_DATE\}\}/g, formatDate(exportDate))
    .replace(/\{\{TOTAL_POSTS\}\}/g, String(posts.length))
    .replace(/\{\{POSTS_CONTENT\}\}/g, postsContent);
}

export async function generateDirectMessagesHTML(
  communityName: string,
  conversations: Map<string, ExportDirectMessage[]>,
  exportDate: string,
): Promise<Map<string, string>> {
  const files = new Map<string, string>();

  const template = await readFile(
    join(__dirname, "..", "templates", "direct-message.html"),
    "utf-8",
  );

  let index = 1;
  for (const [, messages] of conversations) {
    if (messages.length === 0) continue;

    const firstMsg = messages[0];
    if (!firstMsg) continue;

    const participants = `${firstMsg.sender.name} & ${firstMsg.receiver.name}`;
    const filename = `conversation-${index}.html`;

    const messagesContent = messages
      .map((msg) => {
        const profilePicture = msg.sender.profilePictureUrl
          ? `<img src="../images/${escapeHtml(msg.sender.profilePictureUrl.split("/").pop() || "")}" alt="${escapeHtml(msg.sender.name)}" class="profile-picture" />`
          : `<div class="profile-picture-placeholder">${escapeHtml(msg.sender.name.charAt(0).toUpperCase())}</div>`;

        return `
      <div class="message">
        <div class="message-header">
          <div class="sender-info">
            ${profilePicture}
            <div>
              <span class="sender">${escapeHtml(msg.sender.name)}</span>
              <span class="username">@${escapeHtml(msg.sender.username)}</span>
            </div>
          </div>
          <span class="timestamp">${formatDate(msg.createdAt)}</span>
        </div>
        <div class="message-content">${escapeHtml(msg.content)}</div>
        ${
          msg.reactions.length > 0
            ? `<div class="reactions">
          ${msg.reactions
            .map(
              (r) =>
                `<span class="reaction">${escapeHtml(r.emoji)} ${escapeHtml(r.user.name)}</span>`,
            )
            .join("")}
        </div>`
            : ""
        }
      </div>
    `;
      })
      .join("");

    const html = template
      .replace(/\{\{COMMUNITY_NAME\}\}/g, escapeHtml(communityName))
      .replace(/\{\{PARTICIPANTS\}\}/g, escapeHtml(participants))
      .replace(/\{\{EXPORT_DATE\}\}/g, formatDate(exportDate))
      .replace(/\{\{TOTAL_MESSAGES\}\}/g, String(messages.length))
      .replace(/\{\{MESSAGES_CONTENT\}\}/g, messagesContent);

    files.set(filename, html);
    index++;
  }

  return files;
}

export async function generateGroupChatsHTML(
  communityName: string,
  groupChats: ExportGroupChat[],
  exportDate: string,
): Promise<Map<string, string>> {
  const files = new Map<string, string>();

  const template = await readFile(
    join(__dirname, "..", "templates", "group-chat.html"),
    "utf-8",
  );

  let index = 1;
  for (const chat of groupChats) {
    const filename = `group-chat-${index}.html`;

    const messagesContent = chat.messages
      .map((msg) => {
        const profilePicture = msg.sender.profilePictureUrl
          ? `<img src="../images/${escapeHtml(msg.sender.profilePictureUrl.split("/").pop() || "")}" alt="${escapeHtml(msg.sender.name)}" class="profile-picture" />`
          : `<div class="profile-picture-placeholder">${escapeHtml(msg.sender.name.charAt(0).toUpperCase())}</div>`;

        return `
      <div class="message">
        <div class="message-header">
          <div class="sender-info">
            ${profilePicture}
            <div>
              <span class="sender">${escapeHtml(msg.sender.name)}</span>
              <span class="username">@${escapeHtml(msg.sender.username)}</span>
            </div>
          </div>
          <span class="timestamp">${formatDate(msg.createdAt)}</span>
        </div>
        <div class="message-content">${escapeHtml(msg.content)}</div>
        ${
          msg.reactions.length > 0
            ? `<div class="reactions">
          ${msg.reactions
            .map(
              (r) =>
                `<span class="reaction">${escapeHtml(r.emoji)} ${escapeHtml(r.user.name)}</span>`,
            )
            .join("")}
        </div>`
            : ""
        }
      </div>
    `;
      })
      .join("");

    const html = template
      .replace(/\{\{COMMUNITY_NAME\}\}/g, escapeHtml(communityName))
      .replace(/\{\{CHAT_NAME\}\}/g, escapeHtml(chat.name))
      .replace(/\{\{CHAT_CREATED\}\}/g, formatDate(chat.createdAt))
      .replace(/\{\{EXPORT_DATE\}\}/g, formatDate(exportDate))
      .replace(/\{\{TOTAL_MESSAGES\}\}/g, String(chat.messages.length))
      .replace(/\{\{MESSAGES_CONTENT\}\}/g, messagesContent);

    files.set(filename, html);
    index++;
  }

  return files;
}
