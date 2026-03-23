
/**
 * 实验室空间布局配置 - 严格分区版
 */
export interface LabStation {
    id: string;
    x: number;
    y: number;
    type: 'desk' | 'bench' | 'rest';
    item: 'monitor' | 'microscope' | 'rack' | 'spectrometer' | 'centrifuge' | 'workstation' | 'sofa' | 'coffee_table' | 'rug' | 'lamp' | 'water_dispenser' | 'large_plant' | 'achievement_shelf' | 'coffee_machine' | 'cat_bed' | 'dog_bed';
    seed: number;
    themeColor: string;
    clutterLevel: number;
    hasLamp: boolean;
    props: ('coffee' | 'plant' | 'books' | 'water' | 'laptop' | 'magazine')[];
    rotation?: number;
}

export const getLabFloorPlan = (canvasWidth: number): LabStation[] => {
    const stations: LabStation[] = [];
    const deskColors = ['#f8fafc', '#e2e8f0', '#cbd5e1', '#94a3b8', '#f1f5f9'];
    const benchColors = ['#475569', '#334155', '#1e293b', '#0f172a'];

    const sideWallWidth = 90;
    // 玻璃隔断位置
    const dividerX = sideWallWidth + (canvasWidth - sideWallWidth) * 0.58;
    const officeXStart = sideWallWidth + 320;
    const labXStart = dividerX + 80;
    const offsetY = 200;

    // 1. 办公区 (Office Zone)
    for (let i = 0; i < 8; i++) {
        const seed = Math.random();
        const isDual = seed > 0.75;
        let selectedProps = (['coffee', 'plant', 'books', 'water', 'laptop'] as const)
            .filter(() => Math.random() > 0.4);
        if (isDual) selectedProps = selectedProps.filter(p => p !== 'laptop');

        stations.push({
            id: `desk_${i}`,
            x: officeXStart + (i % 2) * 125,
            y: offsetY + Math.floor(i / 2) * 85,
            type: 'desk',
            item: 'monitor',
            seed,
            themeColor: deskColors[i % deskColors.length],
            clutterLevel: Math.floor(seed * 3),
            hasLamp: seed > 0.3,
            props: selectedProps as any
        });
    }

    // 2. 实验区 (Lab Zone)
    const benchItems: any[] = ['microscope', 'rack', 'spectrometer', 'centrifuge', 'workstation'];
    for (let i = 0; i < 8; i++) {
        const seed = Math.random();
        stations.push({
            id: `bench_${i}`,
            x: labXStart + (i % 2) * 145,
            y: offsetY + Math.floor(i / 2) * 85,
            type: 'bench',
            item: benchItems[i % benchItems.length],
            seed,
            themeColor: benchColors[i % benchColors.length],
            clutterLevel: Math.floor(seed * 2),
            hasLamp: false,
            props: ['water', 'books', 'plant'].filter(() => Math.random() > 0.5) as any
        });
    }

    // 3. 休息区 (Lounge)
    const restX = sideWallWidth + 80;
    const restYBase = 320;

    stations.push({
        id: 'lounge_rug', x: restX + 35, y: restYBase + 120,
        type: 'rest', item: 'rug', seed: 0.5, themeColor: '#e2e8f0', clutterLevel: 0, hasLamp: false, props: []
    });

    stations.push({
        id: 'lounge_sofa_1', x: restX, y: restYBase,
        type: 'rest', item: 'sofa', seed: 0.1, themeColor: '#4f46e5', clutterLevel: 1, hasLamp: false, props: ['coffee']
    });

    stations.push({
        id: 'lounge_lamp', x: sideWallWidth - 85, y: restYBase - 40,
        type: 'rest', item: 'lamp', seed: 0.2, themeColor: '#fef3c7', clutterLevel: 0, hasLamp: true, props: []
    });

    stations.push({
        id: 'lounge_shelf', x: sideWallWidth - 85, y: restYBase + 60,
        type: 'rest', item: 'achievement_shelf', seed: 0.9, themeColor: '#1e293b', clutterLevel: 0, hasLamp: false, props: []
    });

    stations.push({
        id: 'lounge_water', x: sideWallWidth - 60, y: restYBase + 160,
        type: 'rest', item: 'water_dispenser', seed: 0.7, themeColor: '#ffffff', clutterLevel: 0, hasLamp: false, props: []
    });

    stations.push({
        id: 'lounge_coffee', x: sideWallWidth - 60, y: restYBase + 240,
        type: 'rest', item: 'coffee_machine', seed: 0.8, themeColor: '#1f2937', clutterLevel: 0, hasLamp: false, props: []
    });

    stations.push({
        id: 'lounge_sofa_2', x: restX, y: restYBase + 240,
        type: 'rest', item: 'sofa', seed: 0.6, themeColor: '#334155', clutterLevel: 0, hasLamp: false, props: [],
        rotation: Math.PI
    });

    stations.push({
        id: 'lounge_table_1', x: restX + 20, y: restYBase + 120,
        type: 'rest', item: 'coffee_table', seed: 0.5, themeColor: '#ffffff', clutterLevel: 2, hasLamp: false, props: ['plant', 'magazine']
    });

    // --- 宠物窝位置设定 ---
    // 猫窝：移动到沙发与咖啡桌中间
    stations.push({
        id: 'pet_cat_bed', x: restX + 10, y: restYBase + 60,
        type: 'rest', item: 'cat_bed', seed: 0.45, themeColor: '#6366f1', clutterLevel: 0, hasLamp: false, props: []
    });

    // 狗窝：向上移动，使其更靠近地毯边缘
    stations.push({
        id: 'pet_dog_bed', x: restX + 130, y: restYBase + 235,
        type: 'rest', item: 'dog_bed', seed: 0.75, themeColor: '#475569', clutterLevel: 0, hasLamp: false, props: []
    });

    stations.push({
        id: 'lounge_plant_1', x: restX + 130, y: restYBase + 30,
        type: 'rest', item: 'large_plant', seed: 0.3, themeColor: '#ffffff', clutterLevel: 0, hasLamp: false, props: []
    });

    stations.push({
        id: 'lounge_plant_2', x: restX + 140, y: restYBase + 200,
        type: 'rest', item: 'large_plant', seed: 0.8, themeColor: '#ffffff', clutterLevel: 0, hasLamp: false, props: []
    });

    return stations;
};
