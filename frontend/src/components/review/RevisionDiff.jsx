export default function RevisionDiff({ diff = [] }) {
  let leftLine = 1;
  let rightLine = 1;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="w-12 p-2 text-right text-slate-400 font-normal">Old</th>
              <th className="w-12 p-2 text-right text-slate-400 font-normal">New</th>
              <th className="p-2 text-left text-slate-400 font-normal">Content</th>
            </tr>
          </thead>
          <tbody>
            {diff.map((line, idx) => {
              let bgColor = '';
              let textColor = 'text-slate-700';
              let prefix = ' ';
              let leftNum = null;
              let rightNum = null;

              if (line.type === 'removed') {
                bgColor = 'bg-red-50';
                textColor = 'text-red-800';
                prefix = '-';
                leftNum = leftLine++;
              } else if (line.type === 'added') {
                bgColor = 'bg-green-50';
                textColor = 'text-green-800';
                prefix = '+';
                rightNum = rightLine++;
              } else {
                bgColor = '';
                textColor = 'text-slate-600';
                prefix = ' ';
                leftNum = leftLine++;
                rightNum = rightLine++;
              }

              return (
                <tr key={idx} className={`${bgColor} border-b border-slate-100`}>
                  <td className="w-12 p-2 text-right text-slate-400 select-none border-r border-slate-100">
                    {leftNum || ''}
                  </td>
                  <td className="w-12 p-2 text-right text-slate-400 select-none border-r border-slate-100">
                    {rightNum || ''}
                  </td>
                  <td className={`p-2 whitespace-pre-wrap ${textColor}`}>
                    <span className="select-none text-slate-400 mr-2">{prefix}</span>
                    {line.content}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
