import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { STATES, type StateKey } from "@/lib/constants";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar, Plus, Users, Trophy, ArrowRight } from "lucide-react";

interface DesignathonEvent {
  id: string;
  title: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

interface Team {
  id: string;
  event_id: string;
  requirement_id: string | null;
  team_name: string;
  members: string[];
  submission_url: string | null;
  score: number | null;
}

interface Requirement {
  id: string;
  title: string;
  current_state: string;
}

const DesignathonManagement = () => {
  const { role } = useAuth();
  const isAdmin = role === "coe_admin";
  const [events, setEvents] = useState<DesignathonEvent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Forms
  const [eventTitle, setEventTitle] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamMembers, setTeamMembers] = useState("");

  const fetchData = async () => {
    const [evRes, tmRes, rqRes] = await Promise.all([
      supabase.from("designathon_events").select("*").order("created_at", { ascending: false }),
      supabase.from("designathon_teams").select("*").order("created_at"),
      supabase.from("requirements").select("id, title, current_state").like("current_state", "H-DES-%"),
    ]);
    setEvents((evRes.data as DesignathonEvent[]) || []);
    setTeams((tmRes.data as Team[]) || []);
    setRequirements((rqRes.data as Requirement[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateEvent = async () => {
    const { error } = await supabase.from("designathon_events").insert({
      title: eventTitle,
      description: eventDesc || null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Event Created" });
      setEventModalOpen(false);
      setEventTitle("");
      setEventDesc("");
      fetchData();
    }
  };

  const handleAddTeam = async () => {
    if (!selectedEventId) return;
    const { error } = await supabase.from("designathon_teams").insert({
      event_id: selectedEventId,
      team_name: teamName,
      members: teamMembers.split(",").map(m => m.trim()).filter(Boolean),
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Team Added" });
      setTeamModalOpen(false);
      setTeamName("");
      setTeamMembers("");
      fetchData();
    }
  };

  const desStates = ["H-DES-1", "H-DES-2", "H-DES-3", "H-DES-4", "H-DES-5", "H-DES-6"];

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Designathon Management</h1>
          <p className="text-sm text-muted-foreground">Active events, teams, and sub-state tracking</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setEventModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Event
          </Button>
        )}
      </div>

      {/* Sub-state Tracker */}
      <Card className="shadow-card">
        <CardHeader><CardTitle className="font-display text-base">Designathon Pipeline</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {desStates.map((state, i) => {
              const info = STATES[state as StateKey];
              const count = requirements.filter(r => r.current_state === state).length;
              return (
                <div key={state} className="flex items-center">
                  <div className={`rounded-lg border px-3 py-2 text-center min-w-[100px] ${count > 0 ? "border-accent bg-accent/10" : "border-border"}`}>
                    <p className="text-[10px] font-medium text-muted-foreground">{state}</p>
                    <p className="text-xs font-medium">{info?.label}</p>
                    <p className="text-lg font-bold font-display text-foreground">{count}</p>
                  </div>
                  {i < desStates.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground mx-1 shrink-0" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Events */}
      {events.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            No designathon events yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        events.map(ev => {
          const evTeams = teams.filter(t => t.event_id === ev.id);
          return (
            <Card key={ev.id} className="shadow-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-base flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-accent" />
                    {ev.title}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={ev.status === "active" ? "default" : "secondary"}>{ev.status}</Badge>
                    {isAdmin && (
                      <Button variant="outline" size="sm" onClick={() => { setSelectedEventId(ev.id); setTeamModalOpen(true); }}>
                        <Users className="mr-1 h-3 w-3" /> Add Team
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {ev.description && <p className="text-sm text-muted-foreground">{ev.description}</p>}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Created {format(new Date(ev.created_at), "PP")}
                </div>

                {evTeams.length > 0 && (
                  <div className="space-y-2 mt-2">
                    <p className="text-xs font-medium text-muted-foreground">Teams ({evTeams.length})</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {evTeams.map(t => (
                        <div key={t.id} className="rounded border p-2.5 text-sm">
                          <p className="font-medium">{t.team_name}</p>
                          {t.members.length > 0 && (
                            <p className="text-xs text-muted-foreground">{t.members.join(", ")}</p>
                          )}
                          {t.score !== null && (
                            <Badge variant="outline" className="mt-1 text-[10px]">Score: {t.score}</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Create Event Modal */}
      <Dialog open={eventModalOpen} onOpenChange={setEventModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Create Designathon Event</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={eventTitle} onChange={e => setEventTitle(e.target.value)} className="mt-1" /></div>
            <div><Label>Description</Label><Textarea value={eventDesc} onChange={e => setEventDesc(e.target.value)} className="mt-1" rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateEvent} disabled={!eventTitle.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Team Modal */}
      <Dialog open={teamModalOpen} onOpenChange={setTeamModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Add Team</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Team Name</Label><Input value={teamName} onChange={e => setTeamName(e.target.value)} className="mt-1" /></div>
            <div><Label>Members (comma-separated)</Label><Input value={teamMembers} onChange={e => setTeamMembers(e.target.value)} className="mt-1" placeholder="Alice, Bob, Charlie" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeamModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAddTeam} disabled={!teamName.trim()}>Add Team</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DesignathonManagement;
