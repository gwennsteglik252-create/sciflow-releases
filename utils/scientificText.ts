// Unicode 上下标映射
export const SUB_DIGITS: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎' };
export const SUP_DIGITS: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾' };

/**
 * 智能转换：自动识别化学式/单位中的数字并转为 Unicode 上下标
 * - 化学式下标：H2O → H₂O, Fe3O4 → Fe₃O₄
 * - 括号后下标：(OH)2 → (OH)₂
 * - 常见单位上标：cm2 → cm², m3 → m³
 */
export const smartConvertChemistry = (text: string): string => {
    // 1. 化学式下标：大写字母(可选小写)+数字 → 下标数字
    let result = text.replace(/([A-Z][a-z]?)(\d+)/g, (_, letters, nums) => {
        const subNums = nums.split('').map((d: string) => SUB_DIGITS[d] || d).join('');
        return letters + subNums;
    });
    // 2. 右括号后的数字也转为下标
    result = result.replace(/\)(\d+)/g, (_, nums) => {
        const subNums = nums.split('').map((d: string) => SUB_DIGITS[d] || d).join('');
        return ')' + subNums;
    });
    // 3. 单位上标：常见单位模式 cm2 → cm², cm-2 → cm⁻², s-1 → s⁻¹
    //    支持负指数和多位指数
    result = result.replace(/\b(cm|mm|nm|μm|km|dm|mol|mg|kg|mA|kW|MW|eV|cd|Pa|Hz|Wh)(-?\d+)\b/g, (_, unit, exp) => {
        const supExp = exp.split('').map((d: string) => SUP_DIGITS[d] || d).join('');
        return unit + supExp;
    });
    // 3b. 单字符单位（m, g, s, L, A, V, W, J, K, N）需要更严格的边界以免误匹配
    //     仅在单位后紧跟 负号+数字 或 纯数字 且后面是空格/标点/行尾时匹配
    result = result.replace(/\b([msLAVWJKNg])(-\d+|\d+)(?=[\s,;.·\/\)°\u00b7]|$)/g, (_, unit, exp) => {
        const supExp = exp.split('').map((d: string) => SUP_DIGITS[d] || d).join('');
        return unit + supExp;
    });
    return result;
};
