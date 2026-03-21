import { motion } from 'framer-motion';
import { Check, Lock, Star } from 'lucide-react';
import { StudyNode, NodeStatus } from '../types';

interface MapNodeProps {
  node: StudyNode;
  onNodeClick: (node: StudyNode) => void;
  key?: string | number;
}

const statusConfig = {
  [NodeStatus.Completed]: {
    Icon: Check,
    bg: 'bg-green-500',
    shadow: 'shadow-lg shadow-green-500/30',
    text: 'text-white',
    ring: 'ring-green-500',
  },
  [NodeStatus.Current]: {
    Icon: Star,
    bg: 'bg-blue-500',
    shadow: 'shadow-lg shadow-blue-500/50',
    text: 'text-white',
    ring: 'ring-blue-400',
  },
  [NodeStatus.Locked]: {
    Icon: Lock,
    bg: 'bg-slate-700',
    shadow: '',
    text: 'text-slate-400',
    ring: 'ring-slate-600',
  },
};

export default function MapNode({ node, onNodeClick }: MapNodeProps) {
  const config = statusConfig[node.status];
  const isLocked = node.status === NodeStatus.Locked;

  const buttonContent = (
    <div className={`relative flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-full ${config.bg} ${config.shadow} ring-4 ${config.ring} ring-offset-4 ring-offset-slate-950 transition-all duration-300`}>
      <config.Icon className={`w-6 h-6 md:w-8 md:h-8 ${config.text}`} />
      {node.status === NodeStatus.Current && (
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-blue-400"
          animate={{ scale: [1, 1.2, 1], opacity: [0, 0.8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  );

  return (
    <div className="flex flex-col items-center z-10">
      <button onClick={() => onNodeClick(node)} disabled={isLocked} className="group focus:outline-none">
        {buttonContent}
      </button>
      <p className={`mt-2 md:mt-3 font-semibold text-center w-24 md:w-32 text-[10px] md:text-sm ${isLocked ? 'text-slate-500' : 'text-slate-200'}`}>
        {node.title.includes(':') ? node.title.split(':')[1].trim() : node.title}
      </p>
    </div>
  );
}