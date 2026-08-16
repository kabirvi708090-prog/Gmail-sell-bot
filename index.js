const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server Setup
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is active!'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Bot Config
const token = "8821189599:AAHSL8MZG3J3m__K4HFAP8EYvMd-xF91CrM";
const bot = new TelegramBot(token, { polling: true });

// Configuration & Data Storage
const OWNER_ID = 8864523429; 
let admins = []; 
let rates = { old: 20, new: 15 };
const userState = {}; 
const userBalances = {};

// বাধ্যতামুলক চ্যানেলসমূহ
const CHANNELS = [
  { name: "চ্যানেল ১", link: "https://t.me/+YoZi58zDphphYTU1", id: "@YoZi58zDphphYTU1" },
  { name: "চ্যানেল ২", link: "https://t.me/skapk20", id: "@skapk20" }
];

// চ্যানেল জয়েন চেক
async function checkMembership(userId) {
  for (let ch of CHANNELS) {
    try {
      const member = await bot.getChatMember(ch.id, userId);
      if (['left', 'kicked'].includes(member.status)) return false;
    } catch (e) {}
  }
  return true;
}

// জয়েন মেসেজ
function sendJoinMessage(chatId) {
  const keyboard = CHANNELS.map(ch => [{ text: `Join ${ch.name}`, url: ch.link }]);
  keyboard.push([{ text: "✅ Check / Verified", callback_data: "check_join" }]);

  bot.sendMessage(chatId, "⚠️ বটটি ব্যবহার করতে হলে আপনাকে অবশ্যই নিচের দুটি চ্যানেলে জয়েন করতে হবে:", {
    reply_markup: { inline_keyboard: keyboard }
  });
}

// মেইন মেনু
function sendMainMenu(chatId) {
  const balance = userBalances[chatId] || 0;
  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📧 Gmail Account Sell", callback_data: "sell_menu" }],
        [{ text: `💰 Balance: ${balance} Tk`, callback_data: "my_balance" }, { text: "💳 Withdraw", callback_data: "withdraw_menu" }],
        [{ text: "👨‍💻 Admin Support", url: "https://t.me/skfreetaka" }]
      ]
    }
  };
  bot.sendMessage(chatId, "আপনার কাঙ্ক্ষিত অপশনটি বেছে নিন:", options);
}

// এডমিন নোটিফিকেশন
function notifyAdminsWithMarkup(messageText, replyMarkup) {
  bot.sendMessage(OWNER_ID, messageText, { parse_mode: 'Markdown', reply_markup: replyMarkup });
  admins.forEach(adminId => {
    bot.sendMessage(adminId, messageText, { parse_mode: 'Markdown', reply_markup: replyMarkup });
  });
}

// START Command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  delete userState[chatId];
  if (!userBalances[chatId]) userBalances[chatId] = 0;

  const isJoined = await checkMembership(chatId);
  if (!isJoined) return sendJoinMessage(chatId);
  sendMainMenu(chatId);
});

// ==================== ADMIN MANAGEMENT COMMANDS ====================

// ১. নতুন এডমিন যুক্ত করা (সর্বোচ্চ ২ জন)
bot.onText(/\/addadmin (\d+)/, (msg, match) => {
  if (msg.from.id !== OWNER_ID) return;
  const newAdminId = parseInt(match[1]);
  if (admins.length >= 2) return bot.sendMessage(msg.chat.id, "❌ সর্বোচ্চ ২ জন এডমিন যোগ করতে পারবেন। আগের এডমিন রিমুভ করুন।");
  if (admins.includes(newAdminId)) return bot.sendMessage(msg.chat.id, "⚠️ এই আইডি অলরেডি এডমিন লিস্টে আছে।");

  admins.push(newAdminId);
  bot.sendMessage(msg.chat.id, `✅ Admin Added: \`${newAdminId}\``, { parse_mode: 'Markdown' });
});

// ২. নির্দিষ্ট এডমিন রিমুভ করা (যেমন: /removeadmin 12345678)
bot.onText(/\/removeadmin (\d+)/, (msg, match) => {
  if (msg.from.id !== OWNER_ID) return;
  const targetAdminId = parseInt(match[1]);

  if (!admins.includes(targetAdminId)) {
    return bot.sendMessage(msg.chat.id, "❌ এই আইডিটি এডমিন লিস্টে পাওয়া যায়নি।");
  }

  admins = admins.filter(id => id !== targetAdminId);
  bot.sendMessage(msg.chat.id, `🗑️ Admin Removed: \`${targetAdminId}\``, { parse_mode: 'Markdown' });
});

// ৩. বর্তমান সকল এডমিনের তালিকা দেখা
bot.onText(/\/admins/, (msg) => {
  if (msg.from.id !== OWNER_ID) return;
  if (admins.length === 0) {
    return bot.sendMessage(msg.chat.id, "ℹ️ বর্তমানে কোনো অতিরিক্ত এডমিন নেই।");
  }

  let listText = "👑 **বর্তমান এডমিন তালিকা:**\n\n";
  admins.forEach((id, index) => {
    listText += `${index + 1}. \`${id}\`\n`;
  });

  bot.sendMessage(msg.chat.id, listText, { parse_mode: 'Markdown' });
});

// ৪. এক ক্লিকে সকল এডমিন ডিলিট করা
bot.onText(/\/clearadmins/, (msg) => {
  if (msg.from.id !== OWNER_ID) return;
  admins = [];
  bot.sendMessage(msg.chat.id, "🧹 সকল অতিরিক্ত এডমিন সফলভাবে রিমুভ করা হয়েছে।");
});

// ৫. জিমেইল রেট সেট করা
bot.onText(/\/setrate (old|new) (\d+)/, (msg, match) => {
  const userId = msg.from.id;
  if (userId !== OWNER_ID && !admins.includes(userId)) {
    return bot.sendMessage(msg.chat.id, "❌ আপনার রেট পরিবর্তন করার অনুমতি নেই।");
  }
  rates[match[1]] = parseInt(match[2]);
  bot.sendMessage(msg.chat.id, `✅ ${match[1].toUpperCase()} Gmail-এর নতুন রেট: ${match[2]} টাকা`);
});

// ===================================================================

// Inline Callbacks
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === "check_join") {
    const isJoined = await checkMembership(chatId);
    if (isJoined) {
      bot.sendMessage(chatId, "🎉 ধন্যবাদ! জয়েন সম্পন্ন হয়েছে।");
      sendMainMenu(chatId);
    } else {
      bot.answerCallbackQuery(query.id, { text: "❌ আপনি সব চ্যানেলে জয়েন করেননি!", show_alert: true });
    }
  }

  if (data === "my_balance") {
    const balance = userBalances[chatId] || 0;
    bot.answerCallbackQuery(query.id, { text: `💳 আপনার বর্তমান ব্যালেন্স: ${balance} টাকা`, show_alert: true });
  }

  if (data === "sell_menu") {
    bot.sendMessage(chatId, "কোন ধরণের জিমেইল বিক্রি করতে চান সিলেক্ট করুন:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📩 Old Gmail", callback_data: "select_old_2fa_status" }],
          [{ text: "📩 New Gmail", callback_data: "submit_new" }],
          [{ text: "🔙 Back", callback_data: "main_menu" }]
        ]
      }
    });
  }

  // Old Gmail - 2FA Selection Step
  if (data === "select_old_2fa_status") {
    bot.sendMessage(chatId, "🔐 আপনার **Old Gmail** একাউন্টে কি 2-Step Verification (2FA) অন আছে?", {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔒 2FA ON (2-Step Verification)", callback_data: "submit_old_2fa_on" }],
          [{ text: "🔓 2FA OFF (Normal)", callback_data: "submit_old_2fa_off" }],
          [{ text: "🔙 Back", callback_data: "sell_menu" }]
        ]
      }
    });
  }

  // Processing 2FA ON or OFF selection
  if (data === "submit_old_2fa_on" || data === "submit_old_2fa_off" || data === "submit_new") {
    let type = "new";
    let is2FA = false;

    if (data === "submit_old_2fa_on") {
      type = "old";
      is2FA = true;
    } else if (data === "submit_old_2fa_off") {
      type = "old";
      is2FA = false;
    }

    const currentRate = rates[type];
    userState[chatId] = { action: 'submitting_gmail', type: type, is2FA: is2FA };

    let promptMessage = `📧 **${type.toUpperCase()} Gmail Submitting**\n💰 বর্তমান রেট: ${currentRate} টাকা\n⚠️ **রুলস:** জিমেইল চেক করার জন্য ২৪ ঘণ্টা সময় লাগবে।\nজিমেইল সাবমিট দেওয়ার আগে অবশ্যই ফোন থেকে রিমুভ করে নেবেন।\n\n`;

    if (is2FA) {
      promptMessage += `🔑 **2FA ON সিলেক্ট করেছেন।**\nনিচের ফরম্যাটে জিমেইল, পাসওয়ার্ড এবং ৮ ডিজিটের প্রেস কি (Backup Codes) লিখে পাঠান:\n\n` +
                        `\`email@gmail.com pass123 code1, code2, code3\``;
    } else {
      promptMessage += `নিচের ফরম্যাটে জিমেইল ও পাসওয়ার্ড লিখে পাঠান:\n\n` +
                        `\`email@gmail.com pass123\``;
    }

    bot.sendMessage(chatId, promptMessage, { parse_mode: 'Markdown' });
  }

  if (data === "withdraw_menu") {
    bot.sendMessage(chatId, "পেমেন্ট পাওয়ার জন্য মাধ্যম সিলেক্ট করুন:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "বিকাশ (Bkash)", callback_data: "withdraw_bkash" }],
          [{ text: "নগদ (Nagad)", callback_data: "withdraw_nagad" }],
          [{ text: "🔙 Back", callback_data: "main_menu" }]
        ]
      }
    });
  }

  if (data === "withdraw_bkash" || data === "withdraw_nagad") {
    const method = data === "withdraw_bkash" ? "Bkash" : "Nagad";
    userState[chatId] = { action: 'withdrawing', method: method };
    bot.sendMessage(chatId, `📲 **${method} Withdraw**\n\nআপনার ${method} নম্বর এবং টাকার পরিমাণ লিখে পাঠান (যেমন: \`01700000000 - 500 Tk\`):`, { parse_mode: 'Markdown' });
  }

  if (data === "main_menu") {
    delete userState[chatId];
    sendMainMenu(chatId);
  }

  // Admin Approve / Reject Actions
  if (data.startsWith("app_") || data.startsWith("rej_")) {
    const action = data.split("_")[0];
    const type = data.split("_")[1];
    const targetUserId = data.split("_")[2];
    const amount = rates[type] || 0;

    if (action === "app") {
      userBalances[targetUserId] = (userBalances[targetUserId] || 0) + amount;
      bot.sendMessage(targetUserId, `🎉 **অভিনন্দন!** আপনার জমা দেওয়া ${type.toUpperCase()} Gmail টি অ্যাপ্রুভ হয়েছে।\n💰 আপনার একাউন্টে **${amount} টাকা** যোগ করা হয়েছে।`);
      bot.sendMessage(chatId, `✅ ইউজার \`${targetUserId}\` এর জিমেইল Approve করা হয়েছে এবং ${amount} টাকা ওয়ালেটে যোগ হয়েছে।`, { parse_mode: 'Markdown' });
    } else if (action === "rej") {
      bot.sendMessage(targetUserId, `❌ **দুঃখিত!** আপনার জমা দেওয়া ${type.toUpperCase()} Gmail টি বাতিল (Reject) করা হয়েছে। তথ্য ভুল বা ইনভেলেড ছিল।`);
      bot.sendMessage(chatId, `❌ ইউজার \`${targetUserId}\` এর জিমেইল Reject করা হয়েছে।`, { parse_mode: 'Markdown' });
    }

    bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id });
  }

  bot.answerCallbackQuery(query.id);
});

// User Text Input Handler
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text && text.startsWith('/')) return;

  const state = userState[chatId];
  if (!state) return;

  // Gmail Submissions Handling
  if (state.action === 'submitting_gmail') {
    bot.sendMessage(chatId, "✅ আপনার জিমেইল সফলভাবে জমা হয়েছে! এডমিন চেক করে ২৪ ঘণ্টার মধ্যে আপডেট দেবে।");

    const parts = text.trim().split(/\s+/);
    let formattedData = "";

    if (parts.length >= 2) {
      const email = parts[0];
      const password = parts[1];
      const remaining = parts.slice(2).join(" ");

      formattedData = `📧 **Email:** \`${email}\`\n🔑 **Password:** \`${password}\``;
      if (remaining) {
        formattedData += `\n📌 **2FA / Extra Info:** \`${remaining}\``;
      }
    } else {
      formattedData = `📄 **Raw Data:** \`${text}\``;
    }

    const adminMsg = `📩 **নতুন জিমেইল সাবমিশন!**\n\n` +
                     `👤 ইউজার: ${msg.from.first_name} (@${msg.from.username || 'N/A'})\n` +
                     `🆔 ইউজার ID: \`${chatId}\`\n` +
                     `📌 টাইপ: ${state.type.toUpperCase()} Gmail${state.is2FA ? '(2FA Enabled)' : ''}\n` +
                     `💰 সম্ভাব্য রেট: ${rates[state.type]} টাকা\n\n` +
                     `👇 **কপি করতে লেখার ওপর টাচ করুন:**\n${formattedData}`;

    const adminMarkup = {
      inline_keyboard: [
        [
          { text: "✅ Approve", callback_data: `app_${state.type}_${chatId}` },
          { text: "❌ Reject", callback_data: `rej_${state.type}_${chatId}` }
        ]
      ]
    };

    notifyAdminsWithMarkup(adminMsg, adminMarkup);
    delete userState[chatId];
  }

  // Withdraw Requests Handling
  if (state.action === 'withdrawing') {
    const currentBal = userBalances[chatId] || 0;
    bot.sendMessage(chatId, "✅ আপনার উইথড্র রিকোয়েস্ট এডমিনের কাছে পাঠানো হয়েছে। খুব শীঘ্রই পেমেন্ট করা হবে।");

    const adminMsg = `💳 **নতুন উইথড্র রিকোয়েস্ট!**\n\n` +
                     `👤 ইউজার: ${msg.from.first_name} (@${msg.from.username || 'N/A'})\n` +
                     `🆔 ইউজার ID: \`${chatId}\`\n` +
                     `💰 বর্তমান একাউন্ট ব্যালেন্স: ${currentBal} টাকা\n` +
                     `মেথড: ${state.method}\n` +
                     `ইউজার ইনপুট: \`${text}\``;

    notifyAdminsWithMarkup(adminMsg, null);
    delete userState[chatId];
  }
});
