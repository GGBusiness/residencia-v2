import { Card, CardBody } from "@/components/ui/card";
import { Zap, CalendarClock } from "lucide-react";

interface PlannerStatsProps {
    events: any[];
    goals: any;
}

export function PlannerStats({ events, goals }: PlannerStatsProps) {
    // 1. Calculate Daily Hours
    const today = new Date().toLocaleDateString('en-CA');
    const todayEvents = events.filter(e => {
        const eDate = typeof e.date === 'string' ? e.date.split('T')[0] : new Date(e.date).toLocaleDateString('en-CA');
        return eDate === today && e.event_type === 'study';
    });

    const calculateDuration = (startTime: string, endTime: string) => {
        if (!startTime || !endTime) return 0;
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        return (endH + endM / 60) - (startH + startM / 60);
    };

    const dailyHours = todayEvents.reduce((acc, curr) => acc + calculateDuration(curr.start_time, curr.end_time), 0);
    const dailyGoal = goals?.daily_hours_goal || 4; // Default fallback
    const dailyProgress = Math.min(100, (dailyHours / dailyGoal) * 100);

    // 2. Calculate Weekly Hours
    // (Simplified: assuming 'events' contains current week's events needed for calculation if passed correctly, 
    // but better to filter by week boundaries)
    const getMonday = (d: Date) => {
        const d2 = new Date(d);
        const day = d2.getDay();
        const diff = d2.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d2.setDate(diff));
    }

    const monday = getMonday(new Date());
    monday.setHours(0, 0, 0, 0);

    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);

    const weeklyEvents = events.filter(e => {
        const eDate = new Date(e.date);
        return eDate >= monday && eDate < nextMonday && e.event_type === 'study';
    });

    const weeklyHours = weeklyEvents.reduce((acc, curr) => acc + calculateDuration(curr.start_time, curr.end_time), 0);
    const weeklyGoal = goals?.weekly_hours_goal || 20;
    const weeklyProgress = Math.min(100, (weeklyHours / weeklyGoal) * 100);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Daily Goal */}
            <Card className="bg-white border-primary-100 shadow-sm">
                <CardBody className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center text-primary-600">
                        <Zap className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-gray-700">Meta Diária</span>
                            <span className="font-bold text-primary-700">{dailyHours.toFixed(1)}h / {dailyGoal}h</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary-500 rounded-full transition-all duration-500"
                                style={{ width: `${dailyProgress}%` }}
                            />
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Weekly Goal */}
            <Card className="bg-white border-purple-100 shadow-sm">
                <CardBody className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                        <CalendarClock className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-gray-700">Meta Semanal</span>
                            <span className="font-bold text-purple-700">{weeklyHours.toFixed(1)}h / {weeklyGoal}h</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-purple-500 rounded-full transition-all duration-500"
                                style={{ width: `${weeklyProgress}%` }}
                            />
                        </div>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
