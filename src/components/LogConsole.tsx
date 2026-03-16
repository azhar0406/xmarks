import { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
}

interface LogConsoleProps {
  logs: LogEntry[];
  onClear: () => void;
}

export default function LogConsole({ logs, onClear }: LogConsoleProps) {
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      case 'warning':
        return 'text-yellow-400';
      default:
        return 'text-gray-300';
    }
  };

  const getLogPrefix = (type: string) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      default:
        return '→';
    }
  };

  return (
    <div className="bg-gray-950 rounded-lg border border-gray-800 overflow-hidden">
      <div className="bg-gray-900 px-4 py-2 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-green-400" />
          <span className="text-sm font-semibold text-gray-300">Console Log</span>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-800"
        >
          Clear
        </button>
      </div>
      <div
        ref={consoleRef}
        className="h-64 overflow-y-auto p-4 font-mono text-sm space-y-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
      >
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            No logs yet. Upload a file or run AI categorization to see logs.
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="flex gap-2">
              <span className="text-gray-600 text-xs whitespace-nowrap">
                {log.timestamp}
              </span>
              <span className={getLogColor(log.type)}>
                {getLogPrefix(log.type)}
              </span>
              <span className={getLogColor(log.type)}>
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
