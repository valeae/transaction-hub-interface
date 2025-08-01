const Header = () => {
  return (
    <header className="bg-header-bg text-white py-8 px-6">
      <div className="container mx-auto text-center">
        <h1 className="text-5xl font-segoe-semibold mb-2">ePayco</h1>
        <h2 className="text-xl font-segoe text-gray-light mb-4">Transaction Hub</h2>
        <div className="w-32 h-1 mx-auto gradient-brand rounded-full"></div>
      </div>
    </header>
  );
};

export default Header;