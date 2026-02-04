import './manual.css';

export const metadata = {
    title: '用户手册 - 量化因子交流论坛',
    description: '量化因子交流论坛使用指南',
};

export default function ManualLayout({ children }) {
    return (
        <div className="manual-layout">
            {children}
        </div>
    );
}
