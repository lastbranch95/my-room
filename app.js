const cfg = window.MY_ROOM_CONFIG || {};
const hasSupabaseConfig =
  cfg.SUPABASE_URL &&
  cfg.SUPABASE_ANON_KEY &&
  !cfg.SUPABASE_URL.includes("YOUR_PROJECT_ID") &&
  !cfg.SUPABASE_ANON_KEY.includes("YOUR_");

const supabaseClient = hasSupabaseConfig
  ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
  : null;

const $ = (id) => document.getElementById(id);

const defaultRooms = [
  { name: "Inbox", icon: "IN", color: "#5865f2", sort_order: 10 },
  { name: "Todo", icon: "TO", color: "#ef6351", sort_order: 20 },
  { name: "URL", icon: "URL", color: "#10b981", sort_order: 30 },
  { name: "日記ネタ", icon: "✎", color: "#f59e0b", sort_order: 40 },
];

let session = null;
let rooms = [];
let messages = [];
let currentRoomId = null;
let searchOpen = false;
let settingsOpen = false;
let searchText = "";
let selectedImageData = "";

function toDbRoom(room) {
  return {
    user_id: session.user.id,
    name: room.name,
    icon: room.icon,
    color: room.color,
    sort_order: room.sort_order,
  };
}

async function init() {
  if (!supabaseClient) {
    $("loginError").textContent = "Supabase設定が未入力です。config.example.js を設定してください。";
    return;
  }

  const { data } = await supabaseClient.auth.getSession();
  session = data.session;

  if (session) {
    showMain();
    await loadAll();
  } else {
    showLogin();
  }

  supabaseClient.auth.onAuthStateChange(async (_event, newSession) => {
    session = newSession;
    if (session) {
      showMain();
      await loadAll();
    } else {
      showLogin();
    }
  });
}

function showLogin() {
  $("loginView").classList.remove("hidden");
  $("mainView").classList.add("hidden");
}

function showMain() {
  $("loginView").classList.add("hidden");
  $("mainView").classList.remove("hidden");
}

async function login() {
  $("loginError").textContent = "";
  const email = $("emailInput").value.trim();
  const password = $("passwordInput").value;
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) $("loginError").textContent = error.message;
}

async function logout() {
  await supabaseClient.auth.signOut();
}

async function ensureDefaultRooms() {
  const { data, error } = await supabaseClient
    .from("my_rooms")
    .select("*")
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  if (data && data.length) return data;

  const inserts = defaultRooms.map(toDbRoom);
  const { data: created, error: insertError } = await supabaseClient
    .from("my_rooms")
    .insert(inserts)
    .select()
    .order("sort_order", { ascending: true });

  if (insertError) throw insertError;
  return created || [];
}

async function loadAll() {
  $("screenSub").textContent = "同期中...";
  rooms = await ensureDefaultRooms();

  const { data: msgData, error: msgError } = await supabaseClient
    .from("my_room_messages")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (msgError) {
    alert(msgError.message);
    return;
  }

  messages = msgData || [];
  $("screenSub").textContent = currentRoomId ? "トークルーム" : "自分専用トークルーム";
  currentRoomId ? renderMessages() : renderRooms();
}

function formatListDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "昨日";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatTime(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function escapeHtml(text = "") {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function linkify(text = "") {
  return escapeHtml(text).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

function getVisibleMessages(roomId = null) {
  return messages
    .filter((m) => !roomId || m.room_id === roomId)
    .filter((m) => {
      if (!searchText.trim()) return true;
      const room = rooms.find((r) => r.id === m.room_id);
      const haystack = `${room?.name || ""} ${m.body || ""}`.toLowerCase();
      return haystack.includes(searchText.trim().toLowerCase());
    })
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function renderRooms() {
  const view = $("roomListView");
  const roomCards = rooms.map((room) => {
    const roomMessages = messages
      .filter((m) => m.room_id === room.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const latest = roomMessages[0];
    const count = roomMessages.length;
    const preview = latest?.body || (latest?.image_data ? "画像" : "まだ投稿なし");
    const visibleCount = getVisibleMessages(room.id).length;
    return { room, latest, count, preview, visibleCount };
  });

  const filtered = searchText.trim()
    ? roomCards.filter((x) => x.visibleCount > 0 || x.room.name.toLowerCase().includes(searchText.toLowerCase()))
    : roomCards;

  if (!filtered.length) {
    view.innerHTML = `<div class="empty">見つからなかった。</div>`;
    return;
  }

  view.innerHTML = filtered.map(({ room, latest, count, preview }) => `
    <article class="room-row" data-room-id="${room.id}">
      <div class="room-icon" style="background:${room.color}">${escapeHtml(room.icon)}</div>
      <div class="room-main">
        <div class="room-title">${escapeHtml(room.name)}${count ? ` (${count})` : ""}</div>
        <div class="room-preview">${escapeHtml(preview)}</div>
      </div>
      <div class="room-date">${formatListDate(latest?.created_at)}</div>
    </article>
  `).join("");

  document.querySelectorAll(".room-row").forEach((el) => {
    el.addEventListener("click", () => openRoom(el.dataset.roomId));
  });
}

function renderMessages() {
  const roomMessages = getVisibleMessages(currentRoomId);
  const wrap = $("messages");

  if (!roomMessages.length) {
    wrap.innerHTML = `<div class="empty">まだ何もない。下から投げ込め。</div>`;
    return;
  }

  let lastDate = "";
  wrap.innerHTML = roomMessages.map((m) => {
    const date = formatDate(m.created_at);
    const divider = date !== lastDate ? `<div class="date-divider">${date}</div>` : "";
    lastDate = date;

    const moveOptions = rooms
      .filter((r) => r.id !== m.room_id)
      .map((r) => `<button data-action="move" data-message-id="${m.id}" data-room-id="${r.id}">→${escapeHtml(r.name)}</button>`)
      .join("");

    return `
      ${divider}
      <div class="message" data-message-id="${m.id}">
        <div class="bubble" data-message-id="${m.id}" title="ダブルクリック / 長押しで操作">
          ${m.body ? `<div class="message-body">${linkify(m.body)}</div>` : ""}
          ${m.image_data ? `<img src="${m.image_data}" alt="添付画像" />` : ""}
          <div class="meta">${formatTime(m.created_at)}</div>
          <div class="message-actions hidden" id="actions-${m.id}">
            ${moveOptions}
            <button data-action="delete" data-message-id="${m.id}">削除</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  wrap.querySelectorAll(".bubble[data-message-id]").forEach((bubble) => {
    let pressTimer = null;

    const togglePanel = () => {
      const panel = document.getElementById(`actions-${bubble.dataset.messageId}`);
      if (panel) panel.classList.toggle("hidden");
    };

    bubble.addEventListener("dblclick", (e) => {
      e.preventDefault();
      togglePanel();
    });

    bubble.addEventListener("touchstart", () => {
      pressTimer = window.setTimeout(togglePanel, 520);
    }, { passive: true });

    bubble.addEventListener("touchend", () => {
      if (pressTimer) window.clearTimeout(pressTimer);
    });

    bubble.addEventListener("touchmove", () => {
      if (pressTimer) window.clearTimeout(pressTimer);
    });
  });

  wrap.querySelectorAll("[data-action='delete']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteMessage(btn.dataset.messageId);
    });
  });
  wrap.querySelectorAll("[data-action='move']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      moveMessage(btn.dataset.messageId, btn.dataset.roomId);
    });
  });

  $("chatView").scrollTop = $("chatView").scrollHeight;
}

function openRoom(roomId) {
  currentRoomId = roomId;
  const room = rooms.find((r) => r.id === roomId);
  $("screenTitle").textContent = room?.name || "Room";
  $("screenSub").textContent = "トークルーム";
  $("roomListView").classList.add("hidden");
  $("chatView").classList.remove("hidden");
  $("composer").classList.remove("hidden");
  $("backBtn").classList.remove("hidden");
  $("settingsPanel").classList.add("hidden");
  settingsOpen = false;
  renderMessages();
}

function backToRooms() {
  currentRoomId = null;
  $("screenTitle").textContent = "My Room";
  $("screenSub").textContent = "自分専用トークルーム";
  $("roomListView").classList.remove("hidden");
  $("chatView").classList.add("hidden");
  $("composer").classList.add("hidden");
  $("backBtn").classList.add("hidden");
  renderRooms();
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function sendMessage() {
  const body = $("messageInput").value.trim();
  if (!body && !selectedImageData) return;
  if (!currentRoomId) return;

  const { error } = await supabaseClient
    .from("my_room_messages")
    .insert({
      user_id: session.user.id,
      room_id: currentRoomId,
      body,
      image_data: selectedImageData || null,
      message_type: selectedImageData ? "image" : "text",
    });

  if (error) {
    alert(error.message);
    return;
  }

  $("messageInput").value = "";
  $("imageInput").value = "";
  selectedImageData = "";
  await loadAll();
}

async function deleteMessage(messageId) {
  const ok = confirm("このメッセージを削除する？\n全端末で消える。");
  if (!ok) return;

  const { error } = await supabaseClient
    .from("my_room_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", messageId);

  if (error) {
    alert(error.message);
    return;
  }
  await loadAll();
}

async function moveMessage(messageId, targetRoomId) {
  const { error } = await supabaseClient
    .from("my_room_messages")
    .update({ room_id: targetRoomId, updated_at: new Date().toISOString() })
    .eq("id", messageId);

  if (error) {
    alert(error.message);
    return;
  }
  await loadAll();
}

async function addRoom() {
  const name = $("newRoomNameInput").value.trim();
  if (!name) return;

  const icon = name.slice(0, 2).toUpperCase();
  const sort_order = rooms.length ? Math.max(...rooms.map((r) => r.sort_order || 0)) + 10 : 10;

  const { error } = await supabaseClient
    .from("my_rooms")
    .insert({
      user_id: session.user.id,
      name,
      icon,
      color: "#5865f2",
      sort_order,
    });

  if (error) {
    alert(error.message);
    return;
  }

  $("newRoomNameInput").value = "";
  await loadAll();
}

function toggleSearch() {
  searchOpen = !searchOpen;
  $("searchPanel").classList.toggle("hidden", !searchOpen);
  if (searchOpen) $("searchInput").focus();
}

function toggleSettings() {
  settingsOpen = !settingsOpen;
  $("settingsPanel").classList.toggle("hidden", !settingsOpen);
}

$("loginBtn").addEventListener("click", login);
$("passwordInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});
$("logoutBtn").addEventListener("click", logout);
$("refreshBtn").addEventListener("click", loadAll);
$("addRoomBtn").addEventListener("click", addRoom);
$("backBtn").addEventListener("click", backToRooms);
$("settingsBtn").addEventListener("click", toggleSettings);
$("searchToggleBtn").addEventListener("click", toggleSearch);
$("clearSearchBtn").addEventListener("click", () => {
  searchText = "";
  $("searchInput").value = "";
  currentRoomId ? renderMessages() : renderRooms();
});
$("searchInput").addEventListener("input", (e) => {
  searchText = e.target.value;
  currentRoomId ? renderMessages() : renderRooms();
});
$("sendBtn").addEventListener("click", sendMessage);
$("messageInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
$("imageBtn").addEventListener("click", () => $("imageInput").click());
$("imageInput").addEventListener("change", async () => {
  const file = $("imageInput").files[0];
  if (!file) return;
  selectedImageData = await fileToDataUrl(file);
  $("messageInput").placeholder = "画像を送信";
});

init();
