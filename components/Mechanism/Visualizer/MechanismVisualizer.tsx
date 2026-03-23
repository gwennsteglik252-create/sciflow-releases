
import React from 'react';
import { VisualizationMode } from '../MechanismWorkshop';
import { EnergyBarrierChart } from './EnergyBarrierChart';
import { VolcanoPlotChart } from './VolcanoPlotChart';
import { StabilityMapChart } from './StabilityMapChart';
import LatticeVisualizer from './LatticeVisualizer';
import DosChart from './DosChart';

interface MechanismVisualizerProps {
  visualizationMode: VisualizationMode;
  setVisualizationMode: (mode: VisualizationMode) => void;
  physicalConstants: any;
  reactionMode: 'HER' | 'OER' | 'ORR' | 'BIFUNCTIONAL';
  potential: number;
  isLightMode: boolean;
  savedSimulations: any[];
  lsvCurves: any;
  benchmarkResult: any;
  volcanoData: any;
  pH: number;
  material: string;
  dopingElement: string;
  dopingConcentration: number;
  coDopingElement?: string;
  coDopingConcentration?: number;
  unitCellType: string;
  onLoadSimulation?: (sim: any) => void;
}

const MechanismVisualizer: React.FC<MechanismVisualizerProps> = ({
  visualizationMode, setVisualizationMode, physicalConstants, reactionMode, potential,
  isLightMode, savedSimulations, lsvCurves, benchmarkResult, volcanoData, pH,
  material, dopingElement, dopingConcentration, coDopingElement, coDopingConcentration, unitCellType,
  onLoadSimulation
}) => {
  return (
    <div className="h-full flex flex-col gap-3 min-h-0 bg-white rounded-[3rem] border border-slate-200 p-1 overflow-hidden">
      {/* 顶部导航切换栏 */}
      <div className="bg-slate-100 p-1.5 rounded-full border border-slate-200 shadow-sm flex justify-center shrink-0 mx-2 mt-2 overflow-x-auto no-scrollbar">
        {(['energy_barrier', 'volcano_plot', 'dos_analysis', 'stability_map', 'lattice_view'] as VisualizationMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => setVisualizationMode(mode)}
            className={`flex-1 py-2 px-3 rounded-full text-[9px] font-black uppercase transition-all whitespace-nowrap ${visualizationMode === mode ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'text-slate-500 hover:text-slate-900'}`}
          >
            {mode === 'energy_barrier' ? '能垒与衰减' :
              mode === 'volcano_plot' ? '活性火山' :
                mode === 'dos_analysis' ? '电子态密度' :
                  mode === 'stability_map' ? '服役寿命' : '晶格拓扑'}
          </button>
        ))}
      </div>

      {/* 可视化核心展示区 - Added more padding p-4 instead of p-3 */}
      <div className="bg-white rounded-[3rem] border border-slate-200 flex flex-col items-center p-4 shadow-inner relative overflow-y-auto custom-scrollbar flex-1 mx-2 mb-2 scroll-smooth">
        <div className="w-full flex flex-col items-center pb-10 min-h-full">
          {visualizationMode === 'energy_barrier' && (
            <EnergyBarrierChart
              physicalConstants={physicalConstants}
              reactionMode={reactionMode}
              potential={potential}
              isLightMode={isLightMode}
              savedSimulations={savedSimulations}
              lsvCurves={lsvCurves}
              benchmarkResult={benchmarkResult}
              dopingConcentration={dopingConcentration}
              dopingElement={dopingElement}
              pH={pH}
            />
          )}

          {visualizationMode === 'volcano_plot' && (
            volcanoData ? (
              <VolcanoPlotChart volcanoData={volcanoData} material={material} onLoadSimulation={onLoadSimulation} />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-40 gap-4 opacity-40">
                <i className="fa-solid fa-circle-notch animate-spin text-4xl text-indigo-500"></i>
                <p className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2rem]">计算火山曲线模型中...</p>
              </div>
            )
          )}

          {visualizationMode === 'stability_map' && (
            <StabilityMapChart
              potential={potential}
              pH={pH}
              dopingConcentration={dopingConcentration}
              dopingElement={dopingElement}
              coDopingConcentration={coDopingConcentration}
            />
          )}

          {visualizationMode === 'lattice_view' && (
            <LatticeVisualizer
              material={material}
              dopingElement={dopingElement}
              dopingConcentration={dopingConcentration}
              coDopingElement={coDopingElement}
              coDopingConcentration={coDopingConcentration}
              unitCellType={unitCellType}
            />
          )}

          {visualizationMode === 'dos_analysis' && (
            <DosChart
              material={material}
              dopingElement={dopingElement}
              dopingConcentration={dopingConcentration}
              coDopingElement={coDopingElement}
              coDopingConcentration={coDopingConcentration}
              isLightMode={isLightMode}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default MechanismVisualizer;
