
/**
 * CoworkerAgent: 具备高级语料库的科研代理实体
 */
import { UserProfile } from '../../types';
import { LabStation } from './collaborationUtils';

export class CoworkerAgent {
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    name: string;
    status: string;
    role: string;
    temperament: string;
    workload: number = 0;
    img: HTMLImageElement | null = null;
    speed: number = 0.022; // 稍微提速

    targetProjectId?: string;
    currentTaskTitle?: string;
    interactionTarget?: string;

    mode: 'idle' | 'walking' | 'working' | 'chilling' | 'inspecting' = 'idle';
    bubbleText: string = "";
    bubbleTimer: number = 0;
    assignedStationIdx: number = -1;
    floatOffset: number = 0;
    tiltAngle: number = 0;

    jumpY: number = 0;
    jumpVelocity: number = 0;
    isJumping: boolean = false;
    spinAngle: number = 0;

    decisionTimer: number = 0;
    walkCycle: number = 0;
    holdingItem: 'coffee' | 'book' | null = null;

    // 语料库：所有数组项在对应模式下等概率触发
    private PHRASES = {
        idle: ["扫描文献中...", "思考中... 🧠", "查看排期", "整理思路", "这个假设有点意思", "该去写 Paper 了"],
        walking: ["前往目标区域", "走动一下...", "实验室巡检", "找个灵感", "路过办公区...", "保持步态平稳"],
        working: {
            generic: ["整理实验报告", "对标数据中", "数据备份...", "撰写方法论章节"],
            explorer: ["尝试突破传统范式", "如果我们改变掺杂比...", "发现新的活性位点？", "假设验证中... 🧪", "寻找非线性响应"],
            optimizer: ["压缩 Tafel 斜率", "提高 0.5% 的效率", "优化合成工艺", "精修晶格参数 💎", "减少副产物生成"],
            skeptic: ["检查系统误差", "数据一致性审计", "这个峰位对不上...", "重核误差线 ⚖️", "怀疑是人为干扰"]
        },
        chilling: {
            generic: ["短暂离线", "望向窗外...", "稍微休息一下", "学术放空时间"],
            coffee_machine: ["咖啡因是第一生产力 ☕", "正在萃取深度烘焙...", "闻起来像 Nature 的味道", "这台机器该除垢了", "双倍 Espresso，双倍效率"],
            water_dispenser: ["补充水分中...", "检查水质硬度", "多喝热水, 少写 Bug", "滤芯该换了喵", "H2O 是生命之源"],
            achievement_shelf: ["那是我们去年的 Nature 一作", "荣誉墙又满了", "下个目标是 Science", "看看这块奖牌", "成果转化率 100%"],
            sofa: ["沙发是避风港...", "闭目养神 10 分钟", "梦见实验大成功", "陷入思维黑洞...", "舒适度对标中"],
            large_plant: ["绿植有助于缓解眼疲劳", "光合作用真解压", "这片叶子长得不错", "需要浇点水吗？", "生物活性观察中"],
            coffee_table: ["看看这本学术周刊", "这里的杂志更新了", "休息区氛围不错", "休闲阅读时刻"],
            desk_chill: ["刷一下手机...", "发呆也是为了更好的思考", "伸个懒腰~", "回复一下邮件", "看看学术圈八卦", "整理一下桌面图标"]
        },
        cheer: ["Perfect! 💎", "Validated ⚛️", "Eureka! 🧪", "Top Tier Data! 🤝", "这数据真硬！🔥", "完美拟合！"]
    };

    constructor(canvasWidth: number, canvasHeight: number, profile: UserProfile, index: number) {
        this.x = 100 + Math.random() * (canvasWidth - 200);
        this.y = 200 + Math.random() * 300;
        this.targetX = this.x;
        this.targetY = this.y;
        this.name = profile.name;
        this.status = profile.availabilityStatus || 'Available';
        this.role = profile.role;
        this.temperament = profile.scientificTemperament || 'Explorer';
        this.workload = profile.workload || 0;
        this.assignedStationIdx = index;

        const image = new Image();
        image.src = profile.avatar;
        image.onload = () => { this.img = image; };
        this.decisionTimer = 10 + Math.random() * 30; // 加快初始决策
    }

    cheer() {
        if (this.isJumping) return;
        this.isJumping = true;
        this.jumpVelocity = -8;
        const pool = this.PHRASES.cheer;
        this.bubbleText = pool[Math.floor(Math.random() * pool.length)];
        this.bubbleTimer = 300; // 显著增加庆祝气泡停留时间
    }

    say(text: string, duration = 400) { // 显著增加默认对话气泡停留时间 (约6-7秒)
        this.bubbleText = text;
        this.bubbleTimer = duration;
    }

    private getContextualPhrase(mode: string, itemType?: string): string {
        if (mode === 'chilling' && itemType) {
            const pool = (this.PHRASES.chilling as any)[itemType] || this.PHRASES.chilling.generic;
            return pool[Math.floor(Math.random() * pool.length)];
        }
        if (mode === 'working') {
            const charKey = this.temperament.toLowerCase() as keyof typeof this.PHRASES.working;
            const pool = this.PHRASES.working[charKey] || this.PHRASES.working.generic;
            const baseText = pool[Math.floor(Math.random() * pool.length)];
            return this.currentTaskTitle ? `${baseText} (${this.currentTaskTitle.substring(0, 6)}...)` : baseText;
        }
        if (mode === 'walking') {
            return this.PHRASES.walking[Math.floor(Math.random() * this.PHRASES.walking.length)];
        }
        return this.PHRASES.idle[Math.floor(Math.random() * this.PHRASES.idle.length)];
    }

    update(canvasWidth: number, canvasHeight: number, stations: LabStation[]) {
        if (this.isJumping) {
            this.jumpY += this.jumpVelocity;
            this.jumpVelocity += 0.45;
            this.spinAngle += 0.15;
            if (this.jumpY >= 0) {
                this.jumpY = 0; this.jumpVelocity = 0; this.isJumping = false; this.spinAngle = 0;
            }
        }

        if (--this.decisionTimer <= 0) {
            const decisionFrenquency = this.temperament === 'Explorer' ? 200 : this.temperament === 'Skeptic' ? 350 : 500;
            this.decisionTimer = decisionFrenquency + Math.random() * 200;

            const rand = Math.random();

            if (this.status === 'On Leave') {
                this.mode = 'idle';
                this.targetX = 120 + Math.random() * 60;
                this.targetY = 480 + Math.random() * 100;
                this.say("休假中... ☕");
            }
            else if (this.currentTaskTitle) {
                const breakProb = this.temperament === 'Explorer' ? 0.3 : this.temperament === 'Optimizer' ? 0.05 : 0.15;
                if (rand > breakProb) {
                    this.mode = 'working';
                    this.interactionTarget = undefined;
                    const labBenches = stations.filter(s => s.type === 'bench');
                    const targetBench = labBenches[this.assignedStationIdx % labBenches.length];
                    this.targetX = targetBench.x;
                    this.targetY = targetBench.y + 12;
                } else {
                    this.mode = 'chilling';
                    // 50% 概率去休息区，50% 概率在工位摸鱼
                    if (Math.random() < 0.5) {
                        const restItems = stations.filter(s => s.type === 'rest' && !['rug'].includes(s.item));
                        const targetItem = restItems[Math.floor(Math.random() * restItems.length)];
                        this.targetX = targetItem.x;
                        this.targetY = targetItem.y + 15;
                        this.interactionTarget = targetItem.item;
                    } else {
                        const desks = stations.filter(s => s.type === 'desk');
                        const myDesk = desks[this.assignedStationIdx % desks.length];
                        this.targetX = myDesk.x;
                        this.targetY = myDesk.y + 15;
                        this.interactionTarget = 'desk_chill';
                    }
                }
            } else {
                if (rand < 0.5) {
                    this.mode = 'chilling';
                    if (Math.random() < 0.5) {
                        const restItems = stations.filter(s => s.type === 'rest' && !['rug'].includes(s.item));
                        const targetItem = restItems[Math.floor(Math.random() * restItems.length)];
                        this.targetX = targetItem.x;
                        this.targetY = targetItem.y + 15;
                        this.interactionTarget = targetItem.item;
                    } else {
                        const desks = stations.filter(s => s.type === 'desk');
                        const myDesk = desks[this.assignedStationIdx % desks.length];
                        this.targetX = myDesk.x;
                        this.targetY = myDesk.y + 15;
                        this.interactionTarget = 'desk_chill';
                    }
                } else if (rand < 0.75) {
                    this.mode = 'walking';
                    this.interactionTarget = undefined;
                    this.targetX = 150 + Math.random() * (canvasWidth - 300);
                    this.targetY = 250 + Math.random() * 350;
                } else {
                    this.mode = 'idle';
                    this.interactionTarget = undefined;
                    const desks = stations.filter(s => s.type === 'desk');
                    const myDesk = desks[this.assignedStationIdx % desks.length];
                    this.targetX = myDesk.x;
                    this.targetY = myDesk.y + 15;
                }
            }
            // 每次决定后立即说一句对应的话
            this.say(this.getContextualPhrase(this.mode, this.interactionTarget));
        }

        const dist = Math.hypot(this.targetX - this.x, this.targetY - this.y);
        if (dist > 3) {
            const dx = (this.targetX - this.x) * this.speed;
            const dy = (this.targetY - this.y) * this.speed;
            this.x += dx;
            this.y += dy;
            this.walkCycle += 0.2; // 加快脚步
            this.tiltAngle = Math.sin(this.walkCycle) * 0.1 + (dx * 0.1);
            this.floatOffset = Math.abs(Math.sin(this.walkCycle)) * -5;
        } else {
            this.tiltAngle *= 0.85;
            this.floatOffset = Math.sin(Date.now() / 600) * 2;
            if (this.mode === 'walking') this.mode = 'idle';

            // Check if holding something based on location
            if (this.mode === 'chilling' && dist < 10) {
                if (this.interactionTarget === 'coffee_machine') this.holdingItem = 'coffee';
                else if (this.interactionTarget === 'coffee_table' || this.interactionTarget === 'sofa') this.holdingItem = 'book';
            }
        }

        // Drop item if working or role changes
        if (this.mode === 'working' || this.status === 'Busy') {
            this.holdingItem = null;
        }

        if (this.bubbleTimer > 0) this.bubbleTimer--;
    }

    drawShadow(ctx: CanvasRenderingContext2D, lightsOn: boolean) {
        const shadowScale = (1 - (this.floatOffset / 50)) * (1 - Math.abs(this.jumpY) / 100);
        if (shadowScale <= 0) return;

        ctx.save();
        const isOverloaded = this.workload >= 80;
        const time = Date.now() / 1000;

        if (isOverloaded) {
            const pulse = 0.85 + Math.sin(time * 7) * 0.15;
            const grad = ctx.createRadialGradient(this.x, this.y + 10, 0, this.x, this.y + 10, 45 * pulse * shadowScale);
            grad.addColorStop(0, 'rgba(225, 29, 72, 0.45)');
            grad.addColorStop(1, 'rgba(225, 29, 72, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(this.x, this.y + 10, 45 * pulse * shadowScale, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.interactionTarget) {
            const grad = ctx.createRadialGradient(this.x, this.y + 10, 0, this.x, this.y + 10, 35 * shadowScale);
            grad.addColorStop(0, 'rgba(251, 191, 36, 0.15)');
            grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(this.x, this.y + 10, 35 * shadowScale, 0, Math.PI * 2);
            ctx.fill();
        }

        const alpha = lightsOn ? 0.1 : 0.18;
        ctx.fillStyle = `rgba(0,0,0,${alpha * shadowScale})`;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + 10, 18 * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (!this.img) return;
        const renderY = this.y + this.floatOffset + this.jumpY;

        ctx.save();
        ctx.translate(this.x, renderY);
        ctx.rotate(this.tiltAngle + this.spinAngle);

        const headY = -15;
        const helmetRadius = 24;

        ctx.beginPath();
        ctx.ellipse(0, 5, 12, 4, 0, 0, Math.PI * 2);
        ctx.fillStyle = this.status === 'Busy' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)';
        ctx.fill();

        ctx.beginPath(); ctx.arc(0, headY, helmetRadius, 0, Math.PI * 2);
        const glassGrad = ctx.createRadialGradient(-7, headY - 7, 2, 0, headY, helmetRadius);
        glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        glassGrad.addColorStop(1, 'rgba(99, 102, 241, 0.4)');
        ctx.fillStyle = glassGrad; ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2; ctx.stroke();

        ctx.save();
        ctx.beginPath(); ctx.arc(0, headY, helmetRadius - 3, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(this.img, -21, headY - 21, 42, 42);
        ctx.restore();

        let ledColor = this.workload >= 80 ? '#f43f5e' : (this.status === 'Busy' ? '#f59e0b' : '#10b981');
        if (this.interactionTarget) ledColor = '#fbbf24';

        ctx.fillStyle = ledColor;
        ctx.shadowBlur = 8;
        ctx.shadowColor = ledColor;
        ctx.beginPath(); ctx.arc(0, 10, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        this.drawIDTag(ctx, renderY);
        if (this.holdingItem) this.drawHoldingItem(ctx, renderY);
        if (this.bubbleTimer > 0) this.drawBubble(ctx, renderY);
    }

    private drawHoldingItem(ctx: CanvasRenderingContext2D, renderY: number) {
        ctx.save();
        const side = Math.sin(this.walkCycle) > 0 ? 1 : -1;
        const armX = 18 * side;
        const armY = 10;

        // 1. Robotic Arm (Industrial/Sci-fi look)
        ctx.save();
        ctx.translate(this.x + armX, renderY + armY);
        ctx.rotate(this.tiltAngle * 1.5 + (Math.sin(Date.now() / 400) * 0.1));

        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';

        // Upper arm to joint
        ctx.beginPath();
        ctx.moveTo(-armX / 2, -armY);
        ctx.quadraticCurveTo(0, 5, 5 * side, 10);
        ctx.stroke();

        // Joint
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.arc(5 * side, 10, 3, 0, Math.PI * 2); ctx.fill();

        // Forearm to prop
        ctx.strokeStyle = '#64748b';
        ctx.beginPath();
        ctx.moveTo(5 * side, 10);
        ctx.lineTo(8 * side, 18);
        ctx.stroke();

        // Gripper / Hand
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(6 * side, 16); ctx.lineTo(12 * side, 18); ctx.moveTo(6 * side, 20); ctx.lineTo(12 * side, 18);
        ctx.stroke();

        // 2. The Prop itself
        ctx.translate(10 * side, 20);
        ctx.rotate(-this.tiltAngle * 2);

        if (this.holdingItem === 'coffee') {
            // Stylized paper cup
            ctx.fillStyle = '#f8fafc';
            ctx.beginPath();
            ctx.moveTo(-5, -8); ctx.lineTo(5, -8);
            ctx.lineTo(4, 2); ctx.lineTo(-4, 2);
            ctx.closePath();
            ctx.fill();
            // Sleeve
            ctx.fillStyle = '#92400e';
            ctx.fillRect(-5, -4, 10, 4);
            // Lid
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(-6, -9, 12, 2);
            // Steam
            const s = Math.sin(Date.now() / 200) * 2;
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, -11); ctx.quadraticCurveTo(s, -15, 0, -19); ctx.stroke();
        } else if (this.holdingItem === 'book') {
            // Small research journal
            ctx.fillStyle = '#4f46e5';
            ctx.fillRect(-7, -10, 14, 18);
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(-5, -8, 10, 14);
            // Lines
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 0.8;
            for (let i = -5; i < 5; i += 3) { ctx.beginPath(); ctx.moveTo(-3, i); ctx.lineTo(3, i); ctx.stroke(); }
            // Cover corner
            ctx.fillStyle = '#818cf8';
            ctx.beginPath(); ctx.moveTo(4, -10); ctx.lineTo(7, -10); ctx.lineTo(7, -7); ctx.fill();
        }

        ctx.restore();
        ctx.restore();
    }

    private drawIDTag(ctx: CanvasRenderingContext2D, renderY: number) {
        ctx.save();
        ctx.translate(this.x, renderY - 65);
        ctx.textAlign = 'center';
        ctx.font = 'bold 9px "Plus Jakarta Sans"';
        const nameText = this.name.toUpperCase();
        const nw = ctx.measureText(nameText).width + 12;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-nw / 2, 0, nw, 14, 6); else ctx.rect(-nw / 2, 0, nw, 14);
        ctx.fill();
        ctx.fillStyle = 'white'; ctx.fillText(nameText, 0, 10);
        ctx.restore();
    }

    private drawBubble(ctx: CanvasRenderingContext2D, renderY: number) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, this.bubbleTimer / 15);
        ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
        const text = this.bubbleText;
        const bw = ctx.measureText(text).width + 24;
        const bh = 28;
        const bx = this.x - bw / 2;
        const by = renderY - 110;

        ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(0,0,0,0.1)';
        ctx.fillStyle = 'white';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 12); else ctx.rect(bx, by, bw, bh);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(this.x - 6, by + bh);
        ctx.lineTo(this.x + 6, by + bh);
        ctx.lineTo(this.x, by + bh + 8);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#1e1b4b';
        ctx.textAlign = 'center';
        ctx.fillText(text, this.x, by + 18);
        ctx.restore();
    }
}
