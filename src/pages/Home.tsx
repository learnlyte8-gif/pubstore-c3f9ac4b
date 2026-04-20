import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const stories = ["You", "alex_w", "mia.k", "noah", "sara", "leo.r", "ana", "kai"];

const Home = () => {
  return (
    <div>
      {/* Stories rail */}
      <section className="border-b border-border py-3">
        <div className="flex gap-4 px-4 overflow-x-auto scrollbar-none">
          {stories.map((name, i) => (
            <button key={name} className="flex flex-col items-center gap-1 shrink-0 w-16">
              <span className={`p-[2px] rounded-full ${i === 0 ? "bg-muted" : "ring-story"}`}>
                <span className="block bg-background p-[2px] rounded-full">
                  <span className="block w-14 h-14 rounded-full bg-muted bg-cover bg-center" style={{ backgroundImage: "url(https://i.pravatar.cc/120?img=" + (i + 5) + ")" }} />
                </span>
              </span>
              <span className="text-[11px] truncate w-full text-center">{name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Empty feed welcome */}
      <section className="px-6 pt-10 pb-6 text-center animate-fade-up">
        <h2 className="font-brand text-3xl mb-2">Welcome to PUBSTORE</h2>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
          Your shop and your feed in one place. Products, stories, and people you love.
        </p>
        <div className="flex gap-2 justify-center mt-6">
          <Button className="bg-primary text-primary-foreground rounded-lg px-5">Browse shop</Button>
          <Button
            variant="outline"
            className="rounded-lg px-5"
            onClick={() => supabase.auth.signOut()}
          >
            Sign out
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Home;
