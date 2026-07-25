// 軽量な CSV パーサ（RFC 4180 準拠寄り・純粋関数）。
//
// 対応:
//   ・BOM 付き UTF-8（先頭 U+FEFF を除去）
//   ・ダブルクォートで囲まれたセル、セル内のカンマ・改行、"" によるクォートのエスケープ
//   ・改行 LF / CRLF / 単独 CR
//   ・完全な空行はスキップ（行番号は保持）
// split(",") のような単純分割はしない。

export type CsvRecord = {
  // レコード開始のファイル行番号（1 始まり）。クォート内改行も数える。
  line: number;
  fields: string[];
};

export function parseCsv(input: string): CsvRecord[] {
  // BOM 除去
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;

  const records: CsvRecord[] = [];
  let field = "";
  let fields: string[] = [];
  let inQuotes = false;
  let line = 1;
  let recordStartLine = 1;
  let started = false;

  const markStart = () => {
    if (!started) {
      recordStartLine = line;
      started = true;
    }
  };
  const endField = () => {
    fields.push(field);
    field = "";
  };
  const endRecord = () => {
    endField();
    const isEmpty = fields.length === 1 && fields[0].trim() === "";
    if (!isEmpty) records.push({ line: recordStartLine, fields });
    fields = [];
    started = false;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      markStart();
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      markStart();
      endField();
      continue;
    }
    if (ch === "\r") {
      // CRLF は次の \n 側で処理。単独 \r は改行扱い。
      if (text[i + 1] === "\n") continue;
      endRecord();
      line++;
      continue;
    }
    if (ch === "\n") {
      endRecord();
      line++;
      continue;
    }

    markStart();
    field += ch;
  }

  // 末尾（改行で終わらない）レコード
  if (started || field.length > 0 || fields.length > 0) {
    endRecord();
  }

  return records;
}
