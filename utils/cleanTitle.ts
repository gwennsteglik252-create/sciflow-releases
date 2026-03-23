/**
 * 清理学术标题中的 HTML 标签、实体，并修正全大写问题
 * 用于处理 CrossRef API 返回的带 HTML 标签的标题
 *
 * 例如：
 *   "ULTRATHIN NI(0)‐EMBEDDED NI(OH)<SUB>2</SUB>" → "Ultrathin Ni(0)‐Embedded Ni(OH)₂"
 *   "Fe<sub>3</sub>O<sub>4</sub>" → "Fe₃O₄"
 */

const SUBSCRIPT_MAP: Record<string, string> = {
  '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉',
  'a':'ₐ','e':'ₑ','h':'ₕ','i':'ᵢ','j':'ⱼ','k':'ₖ','l':'ₗ','m':'ₘ','n':'ₙ',
  'o':'ₒ','p':'ₚ','r':'ᵣ','s':'ₛ','t':'ₜ','u':'ᵤ','v':'ᵥ','x':'ₓ'
};

const SUPERSCRIPT_MAP: Record<string, string> = {
  '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
  '+':'⁺','-':'⁻','=':'⁼','(':'⁽',')':'⁾','n':'ⁿ','i':'ⁱ'
};

export const cleanAcademicTitle = (raw: string | undefined | null): string => {
  if (!raw) return '';
  let s = String(raw);

  // 将 <sub>X</sub> 转化为 Unicode 下标
  s = s.replace(/<sub>(.*?)<\/sub>/gi, (_, inner) =>
    inner.split('').map((c: string) => SUBSCRIPT_MAP[c.toLowerCase()] || c).join('')
  );

  // 将 <sup>X</sup> 转化为 Unicode 上标
  s = s.replace(/<sup>(.*?)<\/sup>/gi, (_, inner) =>
    inner.split('').map((c: string) => SUPERSCRIPT_MAP[c.toLowerCase()] || c).join('')
  );

  // 去除其他所有 HTML 标签 (<i>, <b>, <span> 等)
  s = s.replace(/<[^>]+>/g, '');

  // 解码 HTML 实体
  s = s.replace(/&amp;/g, '&')
       .replace(/&lt;/g, '<')
       .replace(/&gt;/g, '>')
       .replace(/&nbsp;/g, ' ')
       .replace(/&quot;/g, '"')
       .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

  // 如果标题全大写且足够长，转为 Title Case
  const letters = s.replace(/[^a-zA-Z]/g, '');
  if (letters.length > 5 && letters === letters.toUpperCase()) {
    s = s.replace(/\b([A-Z])([A-Z]+)\b/g, (_, first, rest) => {
      // 保留常见缩写和化学式（<=4个字符的全大写词不转换）
      if (rest.length <= 3) return first + rest;
      return first + rest.toLowerCase();
    });
  }

  return s.trim();
};
