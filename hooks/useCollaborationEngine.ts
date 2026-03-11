
/**
 * useCollaborationEngine: 深度集成的实验室仿真引擎
 */
import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { UserProfile, ResearchProject, Publication, InventoryItem } from '../types';
import { CoworkerAgent } from '../components/Team/CoworkerAgent';
import { getLabFloorPlan, LabStation } from '../components/Team/collaborationUtils';
import * as LabRenderer from '../components/Team/LabRenderer';
import { useProjectContext } from '../context/ProjectContext';

interface CollaborationEngineProps {
    members: UserProfile[];
    projects: ResearchProject[];
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    lightsOn: boolean;
    onNavigate: (view: any, projectId?: string, subView?: string) => void;
}

interface CatBubble {
    x: number;
    y: number;
    vx: number;
    vy: number;
    r: number;
    life: number;
    maxLife: number;
}

export const useCollaborationEngine = ({ members, projects, canvasRef, lightsOn, onNavigate }: CollaborationEngineProps) => {
    const { inventory, setReturnPath } = useProjectContext();
    const agentsRef = useRef<CoworkerAgent[]>([]);
    const requestRef = useRef<number>(0);
    const floorPlanRef = useRef<LabStation[]>([]);
    const particlesRef = useRef<{ x: number, y: number, vx: number, vy: number, char: string, opacity: number }[]>([]);
    const lastWidthRef = useRef<number>(0);
    const isDestroyedRef = useRef<boolean>(false);

    const achievements = useMemo(() => {
        const pubs = projects.flatMap(p => p.publications || []);
        return { pubs };
    }, [projects]);

    const recentReagents = useMemo(() =>
        inventory.filter(i => i.category === 'Chemical' || i.category === 'Precursor').slice(0, 10),
        [inventory]);

    const robotRef = useRef({
        x: 500, y: 400, targetX: 500, targetY: 400,
        decisionTimer: 0
    });

    const catRef = useRef({
        x: 300, y: 450, targetX: 300, targetY: 450,
        jumpY: 0, jumpVelocity: 0, isJumping: false,
        surfaceHeight: 0, targetSurfaceHeight: 0,
        isOnSurface: false, decisionTimer: 0,
        phraseTimer: 0,
        proximityCooldown: 0,
        facing: 1,
        state: 'idle' as any,
        intendedState: 'idle' as any,
        mood: 0.5,
        bubbles: [] as CatBubble[],
        bubbleText: "",
        bubbleTimer: 0,
        interactionTarget: null as any
    });

    const dogRef = useRef({
        x: 600, y: 450, targetX: 600, targetY: 450,
        jumpY: 0, jumpVelocity: 0, isJumping: false,
        decisionTimer: 0,
        phraseTimer: 0,
        proximityCooldown: 0,
        facing: 1,
        state: 'idle' as any,
        intendedState: 'idle' as any,
        mood: 0.7,
        bubbleText: "",
        bubbleTimer: 0,
        interactionTarget: null as any
    });

    const droneRef = useRef({
        x: 100, y: 150, targetX: 100, targetY: 150, // Initial rest station
        altitude: 0, angle: 0, state: 'resting',
        waitTimer: 1000, packageType: 'Chemical'
    });

    const newsMessages = useMemo(() => {
        const msgs = [
            "实验室安全检查通过",
            "核心算力分配完成",
            "新批次催化剂已入库",
            "系统已优化晶格解算速度",
            "检测到高效协同区域"
        ];
        projects.forEach(p => {
            if (p.progress > 90) msgs.push(`课题 ${p.title.slice(0, 5)} 即将结题`);
            p.publications?.forEach(pub => msgs.push(`成果发表: ${pub.title.slice(0, 8)}...`));
        });
        return msgs;
    }, [projects]);

    const CAT_PHRASES = {
        idle: ["监工中，别想动我的数据...", "喵呜？这个 Tafel 斜率不太对劲", "这组 LSV 扫描速度太慢了，喵", "设备该涂油了，听声音就有摩擦力", "正在进行喵维度的能带解算...", "又是为了 Nature 奋斗的一天"],
        walking: ["巡视领地，看看谁在偷懒", "去电化学区看看那个异常点", "保持运动，防止晶格塌陷", "闻到了显著性差异的味道，喵"],
        grooming: ["理理思路，学术仪容很重要", "打理毛发，顺便推导一下公式", "洁净度审计中，喵...", "毛发静电可能干扰精密测量"],
        sleeping: ["Zzz... 深度学习中", "梦见 Nature 一作", "后台正在离线计算机理模型", "不要吵，我在推导薛定谔方程", "低功耗待机，数据上云中"],
        hunting: ["发现野生的 ΔG!", "抓住这个离群点!", "数据采集进行时...", "别跑，你这个系统误差！"],
        stretching: ["伸个懒腰，拉伸一下分子间作用力...", "喵呜~ 骨骼肌相变中", "保持柔韧性，才能钻进手套箱"],
        rolling: ["打个滚~ 摩擦生电喵", "地上好凉快，正在进行热交换", "你看不到我，我进入了量子叠加态~"],
        interact_dog: ["傻狗离我远点，别碰我的滴定管", "哈！看招！吃我一记量子神掌", "你是不是又把磁子当磨牙棒了？", "这组动力学曲线你可看不懂，汪汪"],
        interact_human: ["愚蠢的人类，这步算错了", "喵呜（要 99.9% 纯度的小鱼干）", "别挡着我晒太阳，我在光电催化", "快去写论文，别摸我！", "蹭蹭... 你的白大褂质量不错"],
        clicked: ["放肆！我可是正高级职称", "不要摸我，实验还没做完", "喵！！（数据溢出预警）", "被发现了喵！快撤！"]
    };

    const DOG_PHRASES = {
        idle: ["哈...哈... 又是充满活力的一天！", "汪！有人需要捡离心管吗？", "我刚才在那台仪器下捡到了一个磁子！", "汪汪！今天的溶剂味道好清新"],
        walking: ["嗅嗅... 哪里有误差的味道？", "跟着人类有肉吃，汪！", "巡逻安全通道，禁止乱扔吸头", "保持匀速直线运动！"],
        sniffing: ["这组数据... 闻起来有点噪声", "这里的磁子转速平稳，汪！", "嗅到了一股还原剂的气息", "探测到强烈的协同效应！"],
        following: ["我是你的学术僚机！汪！", "守护这组珍贵数据...", "你是我的 PI 吗？汪呜！", "我会保护你的电脑不蓝屏的！"],
        howling: ["嗷呜——！这组数据太漂亮了！", "嗷呜！谁偷了我的骨头模型？", "呼叫其他实验室の修勾！"],
        scratching: ["挠挠痒痒... 好像被静电劈了", "这跳蚤是不是变异了？", "抖一抖，把灰尘和误差都抖掉"],
        interact_cat: ["汪汪！猫哥，帮我推导个公式呗？", "来追我呀！咱们去休息区漂移", "嗅嗅... 猫毛沾到反应釜里了，要挨骂了", "快看！那一组 LSV 数据飞起来了！"],
        interact_human: ["好开心！摸摸头，保佑你不炸釜！", "汪！你是最棒的研究员！", "我想喝那种带彩色标签的洗瓶水（不行）", "带我去散步！或者去实验室跑两圈！", "主人，你的实验结果棒极了！"],
        clicked: ["汪汪汪！动力学起飞！", "嘿！握个手，保佑你不被拒稿！", "汪！发现超级重大的实验突破了吗？", "冲鸭！为了 100% 的转化率！"],
        sleeping: ["Zzz... 梦见满屋子的火腿肠", "汪呜... 刚做完 100 组 LSV 模拟，累坏了", "休假中，请投喂学术零食", "呼... 睡一觉数据就拟合好了"]
    };

    const HUMAN_TO_CAT_PHRASES = [
        "乖猫猫，今天有没有帮我监工？", "来，给你看个神奇的数据！", "别碰那个烧杯！", "工作累了，来吸一口猫能量", "小家伙，帮我看看这个峰值对不对？"
    ];

    const HUMAN_TO_DOG_PHRASES = [
        "好狗子！我们要发顶刊了！", "去，帮我把那个离心管叼过来（开玩笑的）", "今天也很精神呢！", "走，带你去检查安全通道", "谁是实验室最乖的修勾？"
    ];

    const COLLISION_PHRASES = [
        "如果要打破这个对称性...", "拓扑绝缘体的能带模型是否可以...", "这组非线性响应太迷人了",
        "假设我们引入一个量子陷阱...", "这里的熵减过程不符合直觉", "或许可以尝试交叉领域联姻？",
        "动态平衡点可能就在这里", "这个奇异值说明了什么？", "维度坍缩往往意味着新发现",
        "时间晶体的相位纠缠比想象中更稳固", "如果把这个场离散化...", "底层的拓扑荷并没有改变"
    ];

    const getMemberTask = (name: string) => {
        for (const p of projects) {
            const plan = p.weeklyPlans?.find(w => w.status === 'in-progress');
            if (plan) {
                const task = (plan.tasks || []).find(t => t.status === 'pending' && t.assignedTo?.includes(name));
                if (task) return { project: p, task };
            }
        }
        return null;
    };

    const updateAgents = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const currentAgents = agentsRef.current;
        const nextAgents = members.map((member, i) => {
            const existing = currentAgents.find(a => a.name === member.name);
            const agent = existing || new CoworkerAgent((canvas as any).width, (canvas as any).height, member, i);
            const context = getMemberTask(member.name);
            agent.workload = member.workload || 0;
            if (context) {
                agent.status = 'Busy';
                agent.targetProjectId = context.project.id;
                agent.currentTaskTitle = context.task.title;
            } else {
                agent.status = member.availabilityStatus || 'Available';
                agent.targetProjectId = undefined;
                agent.currentTaskTitle = undefined;
            }
            return agent;
        });
        agentsRef.current = nextAgents;
    }, [members, canvasRef, projects]);

    useEffect(() => { updateAgents(); }, [updateAgents]);

    useEffect(() => {
        const canvas = canvasRef.current as any;
        if (!canvas) return;
        isDestroyedRef.current = false;

        const resize = () => {
            if (isDestroyedRef.current || !canvas.parentElement) return;
            const newWidth = canvas.parentElement.clientWidth;
            const newHeight = 650;

            if (Math.abs(lastWidthRef.current - newWidth) > 5) {
                lastWidthRef.current = newWidth;
                canvas.width = newWidth;
                canvas.height = newHeight;
                floorPlanRef.current = getLabFloorPlan(canvas.width);
                const chars = ['ΔG', 'η', 'j', 'Σ', 'H2O', 'e-', 'Pt', 'Ag'];
                particlesRef.current = Array.from({ length: 20 }).map(() => ({
                    x: Math.random() * canvas.width,
                    y: 100 + Math.random() * 500,
                    vx: (Math.random() - 0.5) * 0.4,
                    vy: (Math.random() - 0.5) * 0.4,
                    char: chars[Math.floor(Math.random() * chars.length)],
                    opacity: 0.1 + Math.random() * 0.3
                }));
            }
        };

        const handleMouseDown = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left);
            const mouseY = (e.clientY - rect.top);

            const distRobot = Math.hypot(robotRef.current.x - mouseX, robotRef.current.y - mouseY);
            if (distRobot < 35) { setReturnPath('team/simulation'); onNavigate('assistant', undefined, 'efficiency'); return; }

            const distCat = Math.hypot(catRef.current.x - mouseX, catRef.current.y - mouseY);
            if (distCat < 30) {
                catRef.current.isJumping = true;
                catRef.current.jumpVelocity = -8;
                catRef.current.mood = 1.0;
                catRef.current.bubbleText = CAT_PHRASES.clicked[Math.floor(Math.random() * CAT_PHRASES.clicked.length)];
                catRef.current.bubbleTimer = 200;
                return;
            }
            const distDog = Math.hypot(dogRef.current.x - mouseX, dogRef.current.y - mouseY);
            if (distDog < 35) {
                dogRef.current.isJumping = true;
                dogRef.current.jumpVelocity = -10;
                dogRef.current.mood = 1.0;
                dogRef.current.bubbleText = DOG_PHRASES.clicked[Math.floor(Math.random() * DOG_PHRASES.clicked.length)];
                dogRef.current.bubbleTimer = 200;
                return;
            }

            for (const agent of agentsRef.current) {
                const currentY = agent.y + agent.floatOffset + agent.jumpY;
                const dFeet = Math.hypot(agent.x - mouseX, currentY - mouseY);
                const dHead = Math.hypot(agent.x - mouseX, (currentY - 45) - mouseY);
                if (dFeet < 40 || dHead < 35) {
                    agent.cheer();
                    setReturnPath('team/simulation');
                    if (agent.targetProjectId) onNavigate('project_detail', agent.targetProjectId, 'plan_board:panorama');
                    else onNavigate('team');
                    return;
                }
            }
            for (let i = 0; i < floorPlanRef.current.length; i++) {
                const s = floorPlanRef.current[i];
                const dist = Math.hypot(s.x - mouseX, s.y - mouseY);
                if (dist < 45) {
                    setReturnPath('team/simulation');
                    if (s.item === 'monitor' || s.item === 'workstation') {
                        const assignedAgent = agentsRef.current.find(a => a.assignedStationIdx === i);
                        if (assignedAgent?.targetProjectId) onNavigate('project_detail', assignedAgent.targetProjectId, 'logs');
                        else if (projects.length > 0) onNavigate('project_detail', projects[0].id, 'logs');
                        else onNavigate('projects');
                        return;
                    }
                    if (s.item === 'microscope') { onNavigate('characterization_hub', undefined, 'microscopy'); return; }
                    if (s.item === 'spectrometer') { onNavigate('characterization_hub', undefined, 'spectroscopy'); return; }
                    if (s.item === 'centrifuge') { onNavigate('characterization_hub', undefined, 'kinetics'); return; }
                    if (s.item === 'achievement_shelf') { onNavigate('projects'); return; }
                    if (s.item === 'water_dispenser' || s.item === 'coffee_machine') {
                        const nearest = agentsRef.current.sort((a, b) => Math.hypot(a.x - mouseX, a.y - mouseY) - Math.hypot(b.x - mouseX, b.y - mouseY))[0];
                        if (nearest) nearest.say(s.item === 'coffee_machine' ? "想喝咖啡了？☕" : "多喝点水对身体好 💧");
                        return;
                    }
                }
            }
        };

        resize();
        window.addEventListener('resize', resize);
        canvas.addEventListener('mousedown', handleMouseDown);

        const render = (timestamp: number) => {
            if (isDestroyedRef.current) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const floorPlan = floorPlanRef.current;
            const labSideWallWidth = 90;
            const labWallHeight = canvas.height * 0.22;
            const time = timestamp / 1000;
            const wallTopY = 25;
            const wallBaseY = labWallHeight + wallTopY;
            const dividerX = labSideWallWidth + (canvas.width - labSideWallWidth) * 0.58;

            LabRenderer.drawEnvironment(ctx, canvas.width, canvas.height, lightsOn);
            LabRenderer.drawGlassWall(ctx, canvas.width, canvas.height, lightsOn);
            LabRenderer.applyGlobalLighting(ctx, canvas.width, canvas.height, lightsOn);
            floorPlan.filter(s => s.item === 'rug').forEach(rug => LabRenderer.drawRug(ctx, rug));

            particlesRef.current.forEach(p => {
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
                if (p.y < 100 || p.y > 600) p.vy *= -1;
                LabRenderer.drawDataParticle(ctx, p);
            });

            const robot = robotRef.current;
            if (--robot.decisionTimer <= 0) {
                robot.decisionTimer = 400 + Math.random() * 400;
                robot.targetX = labSideWallWidth + Math.random() * (canvas.width - labSideWallWidth - 100);
                robot.targetY = labWallHeight + 100 + Math.random() * (canvas.height - labWallHeight - 150);
            }
            robot.x += (robot.targetX - robot.x) * 0.005;
            robot.y += (robot.targetY - robot.y) * 0.005;

            const cat = catRef.current;
            const dog = dogRef.current;
            const agents = agentsRef.current;

            agents.forEach(agent => {
                const distHumanCat = Math.hypot(agent.x - cat.x, agent.y - cat.y);
                if (distHumanCat < 50 && cat.proximityCooldown <= 0 && agent.bubbleTimer <= 0 && cat.state !== 'sleeping') {
                    agent.say(HUMAN_TO_CAT_PHRASES[Math.floor(Math.random() * HUMAN_TO_CAT_PHRASES.length)], 350);
                    cat.bubbleText = CAT_PHRASES.interact_human[Math.floor(Math.random() * CAT_PHRASES.interact_human.length)];
                    cat.bubbleTimer = 200;
                    cat.proximityCooldown = 1200;
                    cat.facing = agent.x > cat.x ? 1 : -1;
                    cat.isJumping = true; cat.jumpVelocity = -3;
                }

                const distHumanDog = Math.hypot(agent.x - dog.x, agent.y - dog.y);
                if (distHumanDog < 50 && dog.proximityCooldown <= 0 && agent.bubbleTimer <= 0 && dog.state !== 'sleeping') {
                    agent.say(HUMAN_TO_DOG_PHRASES[Math.floor(Math.random() * HUMAN_TO_DOG_PHRASES.length)], 350);
                    dog.bubbleText = DOG_PHRASES.interact_human[Math.floor(Math.random() * DOG_PHRASES.interact_human.length)];
                    dog.bubbleTimer = 200;
                    dog.proximityCooldown = 1200;
                    dog.facing = agent.x > dog.x ? 1 : -1;
                    dog.isJumping = true; dog.jumpVelocity = -6;
                }
            });

            if (cat.proximityCooldown > 0) cat.proximityCooldown--;
            if (dog.proximityCooldown > 0) dog.proximityCooldown--;

            const distCatDog = Math.hypot(cat.x - dog.x, cat.y - dog.y);
            if (distCatDog < 60 && cat.proximityCooldown <= 0 && cat.state !== 'sleeping' && dog.state !== 'sleeping') {
                cat.proximityCooldown = 900;
                dog.proximityCooldown = 900;
                cat.bubbleText = CAT_PHRASES.interact_dog[Math.floor(Math.random() * CAT_PHRASES.interact_dog.length)];
                dog.bubbleText = DOG_PHRASES.interact_cat[Math.floor(Math.random() * DOG_PHRASES.interact_cat.length)];
                cat.bubbleTimer = 400;
                dog.bubbleTimer = 400;
                cat.isJumping = true; cat.jumpVelocity = -6;
                dog.isJumping = true; dog.jumpVelocity = -8;
                cat.facing = (dog.x > cat.x) ? -1 : 1;
                dog.facing = (cat.x > dog.x) ? -1 : 1;
                cat.decisionTimer = 250;
                dog.decisionTimer = 250;
            }

            if (--cat.decisionTimer <= 0) {
                const rand = Math.random();
                cat.decisionTimer = 400 + Math.random() * 500;
                if (rand < 0.3) {
                    const furniture = floorPlan.filter(s => ['desk', 'bench'].includes(s.type));
                    const target = furniture[Math.floor(Math.random() * furniture.length)];
                    if (target) { cat.targetX = target.x; cat.targetY = target.y + 10; cat.targetSurfaceHeight = -35; cat.intendedState = 'idle'; }
                } else if (rand < 0.6) {
                    const places = floorPlan.filter(s => ['rug', 'sofa', 'coffee_table', 'cat_bed'].includes(s.item));
                    const target = places[Math.floor(Math.random() * places.length)];
                    if (target) { cat.targetX = target.x; cat.targetY = target.y; cat.targetSurfaceHeight = target.item === 'sofa' ? -15 : 0; cat.intendedState = target.item === 'cat_bed' ? 'sleeping' : 'walking'; }
                } else if (rand < 0.7) {
                    cat.intendedState = 'grooming';
                } else if (rand < 0.8) {
                    cat.intendedState = 'stretching';
                } else if (rand < 0.9) {
                    cat.intendedState = 'rolling';
                } else { cat.intendedState = 'idle'; }
                cat.state = 'walking';
            }

            if (--cat.phraseTimer <= 0) {
                cat.phraseTimer = 600 + Math.random() * 600;
                const pool = (CAT_PHRASES as any)[cat.state] || CAT_PHRASES.idle;
                cat.bubbleText = pool[Math.floor(Math.random() * pool.length)];
                cat.bubbleTimer = 300;
            }
            const distToTargetCat = Math.hypot(cat.targetX - cat.x, cat.targetY - cat.y);
            if (distToTargetCat < 5 && cat.state === 'walking') cat.state = cat.intendedState;
            cat.x += (cat.targetX - cat.x) * 0.02; cat.y += (cat.targetY - cat.y) * 0.02;
            if (cat.targetX > cat.x + 2) cat.facing = -1; else if (cat.targetX < cat.x - 2) cat.facing = 1;
            const isTransitioningCat = Math.abs(cat.surfaceHeight - cat.targetSurfaceHeight) > 1;
            if (isTransitioningCat && distToTargetCat < 40) { cat.surfaceHeight += (cat.targetSurfaceHeight - cat.surfaceHeight) * 0.1; cat.jumpY = -Math.sin(Math.PI * (1 - distToTargetCat / 40)) * 20; }
            else if (!isTransitioningCat) { cat.surfaceHeight = cat.targetSurfaceHeight; cat.jumpY = (cat.state === 'sleeping') ? 0 : Math.sin(timestamp / 400) * 1.5; }

            if (--dog.decisionTimer <= 0) {
                const rand = Math.random();
                dog.decisionTimer = 500 + Math.random() * 400;
                if (rand < 0.3) { dog.targetX = 150 + Math.random() * (canvas.width - 300); dog.targetY = 250 + Math.random() * 300; dog.intendedState = 'walking'; }
                else if (rand < 0.5) { const bed = floorPlan.find(s => s.item === 'dog_bed'); if (bed) { dog.targetX = bed.x; dog.targetY = bed.y; dog.intendedState = 'sleeping'; } }
                else if (rand < 0.65 && agents.length > 0) { const targetAgent = agents[Math.floor(Math.random() * agents.length)]; dog.targetX = targetAgent.x + 30; dog.targetY = targetAgent.y; dog.intendedState = 'following'; }
                else if (rand < 0.75) { dog.intendedState = 'sniffing'; }
                else if (rand < 0.85) { dog.intendedState = 'howling'; }
                else if (rand < 0.95) { dog.intendedState = 'scratching'; }
                else { dog.intendedState = 'idle'; }
                dog.state = 'walking';
            }

            if (--dog.phraseTimer <= 0) {
                dog.phraseTimer = 700 + Math.random() * 700;
                const pool = (DOG_PHRASES as any)[dog.state] || DOG_PHRASES.idle;
                dog.bubbleText = pool[Math.floor(Math.random() * pool.length)];
                dog.bubbleTimer = 300;
            }
            const distToTargetDog = Math.hypot(dog.targetX - dog.x, dog.targetY - dog.y);
            if (distToTargetDog < 5 && dog.state === 'walking') dog.state = dog.intendedState;
            dog.x += (dog.targetX - dog.x) * 0.02; dog.y += (dog.targetY - dog.y) * 0.02;
            if (dog.targetX > dog.x + 2) dog.facing = -1; else if (dog.targetX < dog.x - 2) dog.facing = 1;
            if (dog.isJumping) { dog.jumpY += dog.jumpVelocity; dog.jumpVelocity += 0.55; if (dog.jumpY >= 0) { dog.jumpY = 0; dog.isJumping = false; } }
            else { dog.jumpY = dog.state === 'sleeping' ? 0 : Math.abs(Math.sin(timestamp / 300)) * -4; }

            const renderQueue: any[] = [];
            floorPlan.filter(s => s.item !== 'rug').forEach((s, idx) => {
                const activeAgent = agents.find(a => Math.hypot(a.x - s.x, (a.y - 15) - s.y) < 25);
                const activeProj = activeAgent?.targetProjectId ? projects.find(p => p.id === activeAgent.targetProjectId)?.title : undefined;
                renderQueue.push({ type: 'furniture', y: s.y - 18, data: { ...s, activeProject: activeProj } });
                if (s.type !== 'rest') renderQueue.push({ type: 'chair', y: s.y + 12, data: s });
                if (s.type === 'bench' && recentReagents.length > 0) {
                    const reagent = recentReagents[idx % recentReagents.length];
                    if (reagent) renderQueue.push({ type: 'reagent', y: s.y - 35, data: { x: s.x - 20, y: s.y - 10, item: reagent } });
                }
            });
            const restAreaTable = floorPlan.find(s => s.item === 'coffee_table');
            const pillarX = restAreaTable ? restAreaTable.x - 85 : labSideWallWidth + 30;
            const pillarY = restAreaTable ? restAreaTable.y + 15 : 360;

            // Knowledge Core Position (Moved further right as requested)
            const coreX = dividerX + (canvas.width - dividerX) * 0.85; // Much closer to right wall
            const coreY = wallBaseY + 20; // Near the back wall base

            const activeTasksCount = projects.reduce((acc, p) => acc + (p.weeklyPlans?.find(w => w.status === 'in-progress')?.tasks.filter(t => t.status === 'pending').length || 0), 0);
            const coreIntensity = Math.min(1.5, 0.5 + activeTasksCount * 0.1);

            renderQueue.push({ type: 'knowledge_core', y: coreY, data: { x: coreX, y: coreY, intensity: coreIntensity } });
            renderQueue.push({ type: 'hologram', y: pillarY, data: { x: pillarX, y: pillarY } });

            // News board on back wall (Moved slightly left as requested)
            renderQueue.push({ type: 'news_board', y: wallTopY + 25, data: { x: labSideWallWidth + 240, y: wallTopY + 25 } });

            // Drone logic
            const drone = droneRef.current;
            const restStation = { x: dividerX - 40, y: wallBaseY - 15, alt: 0 }; // On a shelf or specialized spot

            // Draw drone station (Sorting Y slightly less to stay underneath drone)
            renderQueue.push({ type: 'drone_station', y: restStation.y - 5, data: restStation });

            if (drone.state === 'resting') {
                drone.targetX = restStation.x; drone.targetY = restStation.y;
                drone.x += (drone.targetX - drone.x) * 0.05;
                drone.y += (drone.targetY - drone.y) * 0.05;
                drone.altitude += (restStation.alt - drone.altitude) * 0.05;
                if (--drone.waitTimer <= 0) {
                    drone.state = 'entering';
                    drone.targetX = 100 + Math.random() * 200;
                    drone.waitTimer = 0;
                }
            } else if (drone.state === 'entering') {
                drone.altitude += (40 - drone.altitude) * 0.05;
                drone.x += (drone.targetX - drone.x) * 0.02;
                if (Math.abs(drone.x - drone.targetX) < 5) drone.state = 'delivering';
            } else if (drone.state === 'delivering') {
                const bences = floorPlan.filter(s => s.type === 'bench');
                const targetBench = bences[3] || bences[0];
                drone.targetX = targetBench.x; drone.targetY = targetBench.y;
                drone.x += (drone.targetX - drone.x) * 0.01;
                drone.y += (drone.targetY - drone.y) * 0.01;
                if (Math.hypot(drone.x - drone.targetX, drone.y - drone.targetY) < 10) {
                    drone.state = 'waiting'; drone.waitTimer = 300;
                }
            } else if (drone.state === 'waiting') {
                if (--drone.waitTimer <= 0) {
                    drone.state = 'leaving'; drone.targetX = restStation.x; drone.targetY = restStation.y;
                }
            } else if (drone.state === 'leaving') {
                drone.x += (drone.targetX - drone.x) * 0.02;
                drone.y += (drone.targetY - drone.y) * 0.02;
                if (Math.hypot(drone.x - restStation.x, drone.y - restStation.y) < 10) {
                    drone.state = 'resting'; drone.waitTimer = 1500 + Math.random() * 2000; // Long rest
                }
            }
            renderQueue.push({ type: 'drone', y: drone.y, data: drone });

            // Synergy Sparks (Sparks fly when members are collaborating OR just chatting when idle)
            agents.forEach((a, idx) => {
                agents.slice(idx + 1).forEach(a2 => {
                    const dist = Math.hypot(a.x - a2.x, a.y - a2.y);
                    const isCollaborating = a.targetProjectId && a.targetProjectId === a2.targetProjectId;
                    const isBrowsingLounge = a.status === 'Available' && a2.status === 'Available' && dist < 120;

                    if (dist < 120 && (isCollaborating || isBrowsingLounge)) {
                        // Increase probability of spark or just show it
                        renderQueue.push({ type: 'synergy', y: Math.max(a.y, a2.y), data: { x1: a.x, y1: a.y, x2: a2.x, y2: a2.y } });

                        // Random Inspiration Collision Dialogue
                        if (Math.random() < 0.005 && a.bubbleTimer <= 0 && a2.bubbleTimer <= 0) {
                            const p1 = COLLISION_PHRASES[Math.floor(Math.random() * COLLISION_PHRASES.length)];
                            const p2 = COLLISION_PHRASES[Math.floor(Math.random() * COLLISION_PHRASES.length)];
                            a.say(`💡 ${p1}`, 500);
                            a2.say(`✨ ${p2}`, 500);
                        }
                    }
                });
            });

            agents.forEach(a => { a.update(canvas.width, canvas.height, floorPlan); renderQueue.push({ type: 'agent', y: a.y, data: a }); });
            renderQueue.push({ type: 'robot', y: robot.y, data: robot });
            renderQueue.push({ type: 'cat', y: cat.y + cat.surfaceHeight, data: cat });
            renderQueue.push({ type: 'dog', y: dog.y, data: dog });
            renderQueue.sort((a, b) => a.y - b.y);
            renderQueue.forEach(item => {
                if (item.type === 'furniture') { if (item.data.item === 'achievement_shelf') LabRenderer.drawAchievementShelf(ctx, item.data, achievements.pubs); else if (item.data.item === 'coffee_machine') LabRenderer.drawCoffeeMachine(ctx, item.data); else LabRenderer.draw3DFurniture(ctx, item.data, item.data.activeProject); }
                else if (item.type === 'chair') LabRenderer.draw3DChair(ctx, item.data);
                else if (item.type === 'robot') LabRenderer.drawRobotAssistant(ctx, item.data.x, item.data.y);
                else if (item.type === 'hologram') LabRenderer.drawHolographicPillar(ctx, item.data.x, item.data.y, projects, time);
                else if (item.type === 'knowledge_core') LabRenderer.drawKnowledgeCore(ctx, item.data.x, item.data.y, item.data.intensity, time);
                else if (item.type === 'drone_station') LabRenderer.drawDroneStation(ctx, item.data.x, item.data.y);
                else if (item.type === 'drone') LabRenderer.drawDrone(ctx, item.data.x, item.data.y, item.data.angle, item.data.altitude, time);
                else if (item.type === 'synergy') LabRenderer.drawSynergySpark(ctx, item.data.x1, item.data.y1, item.data.x2, item.data.y2, time);
                else if (item.type === 'news_board') LabRenderer.drawLiveNewsBoard(ctx, item.data.x, item.data.y, newsMessages, time);
                else if (item.type === 'cat') LabRenderer.drawCat(ctx, item.data.x, item.data.y, item.data.jumpY + item.data.surfaceHeight, item.data.state, item.data.mood, item.data.bubbles, item.data.bubbleText, item.data.bubbleTimer, item.data.facing);
                else if (item.type === 'dog') LabRenderer.drawDog(ctx, item.data.x, item.data.y, item.data.jumpY, item.data.state, item.data.mood, item.data.bubbleText, item.data.bubbleTimer, item.data.facing);
                else if (item.type === 'reagent') LabRenderer.drawDynamicReagentBottle(ctx, item.data.x, item.data.y, item.data.item);
                else { item.data.drawShadow(ctx, lightsOn); item.data.draw(ctx); }
            });
            requestRef.current = requestAnimationFrame(render);
        };
        requestRef.current = requestAnimationFrame(render);
        return () => {
            isDestroyedRef.current = true;
            cancelAnimationFrame(requestRef.current);
            window.removeEventListener('resize', resize);
            canvas.removeEventListener('mousedown', handleMouseDown);
        };
    }, [canvasRef, members, projects, lightsOn, onNavigate, achievements, recentReagents, setReturnPath]);

    return { agents: agentsRef.current, floorPlan: floorPlanRef.current };
};
