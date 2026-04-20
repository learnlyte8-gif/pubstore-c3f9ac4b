const Placeholder = ({ title, hint }: { title: string; hint: string }) => (
  <div className="flex flex-col items-center justify-center text-center px-6 py-24 animate-fade-up">
    <h2 className="font-brand text-3xl mb-2">{title}</h2>
    <p className="text-muted-foreground text-sm max-w-xs">{hint}</p>
  </div>
);

export default Placeholder;
