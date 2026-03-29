import React from 'react';
import Header from './Header';
import SidebarLeft from './SidebarLeft';
import SidebarRight from './SidebarRight';

const Layout = ({ children, hideRightSidebar = false }) => {
    return (
        <div className="min-h-screen bg-background-main dark:bg-cosmic-bg dark:text-gray-100 font-sans transition-colors duration-500">
            <Header />

            <div className="pt-[60px] flex justify-center">
                <SidebarLeft />

                <main className={`flex-1 w-full mx-4 md:ml-[250px] py-6 ${hideRightSidebar ? 'max-w-6xl px-4' : 'max-w-[700px] lg:mr-[320px]'}`}>
                    {children}
                </main>

                {!hideRightSidebar && <SidebarRight />}
            </div>
        </div>
    );
};

export default Layout;
