const text = "1. First item.\n2. Second item.\n\n3. Third item.";
const parts = [text];

parts.forEach(part => {
    const paragraphs = part.split(/(\n{2,})/);
    let subParaOffset = 0;
    paragraphs.forEach((p, pIdx) => {
        // The original logic:
        if (pIdx % 2 !== 0 || !p.trim()) { 
            console.log(`Skipped: [${p.replace(/\n/g, '\\n')}]`);
            subParaOffset += p.length; 
            return; 
        }
        
        console.log(`Kept: [${p.replace(/\n/g, '\\n')}]`);
    });
});
