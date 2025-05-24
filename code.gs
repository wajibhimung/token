// Code.gs - Aplikasi Token Ujian Menggunakan Pola doGet (seperti Teaching Journal)

// Konfigurasi Global
const USER_SHEET_NAME = "Users";    // Sesuaikan dengan nama sheet pengguna Anda
const TOKEN_SHEET_NAME = "Tokens";  // Sesuaikan dengan nama sheet token Anda
// SPREADSHEET_ID tidak perlu didefinisikan global jika script terikat
// Jika standalone, Anda mungkin perlu: const SPREADSHEET_ID = "ID_SPREADSHEET_ANDA";

// Fungsi utama untuk menangani semua permintaan API via GET
function doGet(e) {
  let result;
  let output;

  try {
    // Untuk debugging parameter yang diterima
    Logger.log(`doGet Parameters: ${JSON.stringify(e.parameter)}`);

    const action = e.parameter.action;

    if (!action) {
      result = { success: false, error: "Parameter 'action' dibutuhkan." };
    } else {
      switch (action) {
        case 'ping':
          result = { success: true, message: "API Token Ujian Aktif (via GET)" };
          break;
        case 'login':
          // Pastikan parameter username dan password ada
          if (!e.parameter.username || !e.parameter.password) {
            result = { success: false, error: "Username dan password dibutuhkan untuk login." };
          } else {
            result = handleLogin(e.parameter);
          }
          break;
        case 'getTokens':
          result = handleGetTokens();
          break;
        case 'addToken':
          // Validasi parameter yang dibutuhkan untuk addToken
          if (!e.parameter.mataPelajaran || !e.parameter.tokenValue || !e.parameter.status) {
            result = { success: false, error: "mataPelajaran, tokenValue, dan status dibutuhkan untuk menambah token." };
          } else {
            result = handleAddToken(e.parameter);
          }
          break;
        case 'editToken':
          // Validasi parameter yang dibutuhkan untuk editToken
          if (!e.parameter.id || !e.parameter.mataPelajaran || !e.parameter.tokenValue || !e.parameter.status) {
            result = { success: false, error: "id, mataPelajaran, tokenValue, dan status dibutuhkan untuk mengedit token." };
          } else {
            result = handleEditToken(e.parameter);
          }
          break;
        case 'deleteToken':
          // Validasi parameter yang dibutuhkan untuk deleteToken
          if (!e.parameter.id) {
            result = { success: false, error: "id dibutuhkan untuk menghapus token." };
          } else {
            result = handleDeleteToken(e.parameter);
          }
          break;
        default:
          result = { success: false, error: `Aksi tidak valid: ${action}` };
      }
    }
    
    output = ContentService.createTextOutput(JSON.stringify(result))
                           .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log(`Error di doGet: ${error.toString()}\nStack: ${error.stack || 'Tidak ada stack trace'}`);
    result = { success: false, error: `Error Server: ${error.toString()}` };
    output = ContentService.createTextOutput(JSON.stringify(result))
                           .setMimeType(ContentService.MimeType.JSON);
  }
  
  // Penting untuk CORS jika diperlukan secara eksplisit (meskipun deployment "Anyone" seharusnya cukup)
  // Jika Anda masih menghadapi masalah CORS dengan GET, Anda bisa mencoba uncomment ini.
  // Namun, dengan GET sederhana, biasanya tidak perlu.
  // output.setHeader('Access-Control-Allow-Origin', '*');
  // output.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS'); // Hanya GET dan OPTIONS
  // output.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  return output;
}

// --- Fungsi Helper & Business Logic ---

// Helper untuk mendapatkan sheet (dan membuatnya jika belum ada)
function getSheet(sheetName, headersArray = null, columnWidths = null) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet && headersArray) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headersArray);
    const headerRange = sheet.getRange(1, 1, 1, headersArray.length);
    headerRange.setFontWeight("bold").setBackground("#E8EAED");
    if (columnWidths && columnWidths.length === headersArray.length) {
        for (let i = 0; i < columnWidths.length; i++) {
            sheet.setColumnWidth(i + 1, columnWidths[i]);
        }
    }
    Logger.log(`Sheet "${sheetName}" dibuat dengan header.`);
  } else if (!sheet) {
     throw new Error(`Sheet "${sheetName}" tidak ditemukan dan tidak ada header yang disediakan untuk membuatnya.`);
  }
  return sheet;
}

function handleLogin(params) {
  try {
    const sheet = getSheet(USER_SHEET_NAME, ["Username", "Password"]); // Buat sheet jika belum ada
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) { // Mulai dari 1 untuk skip header
      if (data[i][0] === params.username && data[i][1] === params.password) {
        Logger.log(`Login berhasil untuk: ${params.username}`);
        return { success: true, message: "Login berhasil." };
      }
    }
    Logger.log(`Login gagal untuk: ${params.username}`);
    return { success: false, error: "Username atau password salah." };
  } catch (error) {
    Logger.log(`Error di handleLogin: ${error.toString()}`);
    return { success: false, error: `Error saat login: ${error.toString()}` };
  }
}

function handleGetTokens() {
  try {
    const sheet = getSheet(TOKEN_SHEET_NAME, ["ID", "MataPelajaran", "Token", "Status"], [150, 200, 150, 80]);
    const data = sheet.getDataRange().getValues();
    const tokens = [];
    const headers = data[0]; // Ambil header

    for (let i = 1; i < data.length; i++) { // Mulai dari 1 untuk skip header
      if (data[i][0]) { // Pastikan ada ID
        let tokenObj = {};
        for(let j=0; j < headers.length; j++){
            // Khusus untuk status, parse ke integer
            if(headers[j].toLowerCase() === 'status'){
                tokenObj[headers[j]] = parseInt(data[i][j]);
            } else {
                tokenObj[headers[j]] = data[i][j];
            }
        }
        tokens.push(tokenObj);
      }
    }
    Logger.log(`Mengambil ${tokens.length} token.`);
    return { success: true, data: tokens };
  } catch (error) {
    Logger.log(`Error di handleGetTokens: ${error.toString()}`);
    return { success: false, error: `Error mengambil data token: ${error.toString()}` };
  }
}

function generateUniqueId(prefix = "id_") {
  return prefix + new Date().getTime() + "_" + Math.random().toString(36).substr(2, 7);
}

function handleAddToken(params) {
  try {
    const sheet = getSheet(TOKEN_SHEET_NAME, ["ID", "MataPelajaran", "Token", "Status"], [150, 200, 150, 80]);
    const newId = generateUniqueId("token_");
    // Pastikan status adalah integer 0 atau 1
    const status = parseInt(params.status);
    if (status !== 0 && status !== 1) {
        return { success: false, error: "Status harus 0 (Nonaktif) atau 1 (Aktif)." };
    }

    sheet.appendRow([
      newId,
      params.mataPelajaran,
      params.tokenValue, // Disesuaikan dengan parameter dari frontend
      status
    ]);
    Logger.log(`Token ditambahkan: ${newId}`);
    return { success: true, message: "Token berhasil ditambahkan.", id: newId };
  } catch (error) {
    Logger.log(`Error di handleAddToken: ${error.toString()}`);
    return { success: false, error: `Error menambah token: ${error.toString()}` };
  }
}

function handleEditToken(params) {
  try {
    const sheet = getSheet(TOKEN_SHEET_NAME); // Asumsikan sheet sudah ada dengan header
    const data = sheet.getDataRange().getValues();
    const idToEdit = params.id;
    let rowIndex = -1;

    for (let i = 1; i < data.length; i++) { // Mulai dari 1 (skip header)
      if (data[i][0] === idToEdit) { // Kolom pertama (indeks 0) adalah ID
        rowIndex = i + 1; // Sheet is 1-indexed
        break;
      }
    }

    if (rowIndex === -1) {
      return { success: false, error: `Token dengan ID "${idToEdit}" tidak ditemukan.` };
    }
    
    // Pastikan status adalah integer 0 atau 1
    const status = parseInt(params.status);
    if (status !== 0 && status !== 1) {
        return { success: false, error: "Status harus 0 (Nonaktif) atau 1 (Aktif)." };
    }

    sheet.getRange(rowIndex, 2).setValue(params.mataPelajaran); // Kolom B: MataPelajaran
    sheet.getRange(rowIndex, 3).setValue(params.tokenValue);    // Kolom C: Token
    sheet.getRange(rowIndex, 4).setValue(status);               // Kolom D: Status
    Logger.log(`Token diedit: ${idToEdit}`);
    return { success: true, message: "Token berhasil diperbarui." };
  } catch (error) {
    Logger.log(`Error di handleEditToken: ${error.toString()}`);
    return { success: false, error: `Error mengedit token: ${error.toString()}` };
  }
}

function handleDeleteToken(params) {
  try {
    const sheet = getSheet(TOKEN_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const idToDelete = params.id;
    let rowIndex = -1;

    for (let i = 1; i < data.length; i++) { // Mulai dari 1 (skip header)
      if (data[i][0] === idToDelete) { // Kolom pertama (indeks 0) adalah ID
        rowIndex = i + 1; // Sheet is 1-indexed
        break;
      }
    }

    if (rowIndex === -1) {
      return { success: false, error: `Token dengan ID "${idToDelete}" tidak ditemukan.` };
    }

    sheet.deleteRow(rowIndex);
    Logger.log(`Token dihapus: ${idToDelete}`);
    return { success: true, message: "Token berhasil dihapus." };
  } catch (error) {
    Logger.log(`Error di handleDeleteToken: ${error.toString()}`);
    return { success: false, error: `Error menghapus token: ${error.toString()}` };
  }
}

// Fungsi setup untuk membuat sheet awal jika belum ada (opsional, bisa dijalankan manual)
function setupSheets() {
  getSheet(USER_SHEET_NAME, ["Username", "Password"]);
  getSheet(TOKEN_SHEET_NAME, ["ID", "MataPelajaran", "Token", "Status"], [150, 200, 150, 80]);
  SpreadsheetApp.getUi().alert("Setup sheets selesai.");
}