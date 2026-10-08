import React, { useMemo, useState } from 'react';
import { useHRData } from '@/hooks/useHRData';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Clock,
  Fingerprint,
  MapPin,
  Monitor,
  TestTube2,
  UserCheck,
} from 'lucide-react';

type SimulatedEventType = 'CLOCK_IN' | 'CLOCK_OUT';

interface SimulatedAttendanceEvent {
  id: string;
  deviceId: string;
  factory: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  eventType: SimulatedEventType;
  timestamp: string;
}

const AttendanceSimulator: React.FC = () => {
  const { employees, loading } = useHRData();

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [events, setEvents] = useState<SimulatedAttendanceEvent[]>([]);

  const activeEmployees = useMemo(
    () =>
      (employees || [])
        .filter((employee: any) => employee.status?.toLowerCase() === 'active')
        .sort((a: any, b: any) =>
          String(a.employee_number || '').localeCompare(
            String(b.employee_number || ''),
          ),
        ),
    [employees],
  );

  const selectedEmployee = activeEmployees.find(
    (employee: any) => employee.id === selectedEmployeeId,
  );

  const simulateAttendance = async (eventType: SimulatedEventType) => {
  if (!selectedEmployee) return;

  const now = new Date();
  const attendanceDate = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().slice(0, 8);

  // Check whether this employee already has attendance for today
  const { data: existingAttendance, error: lookupError } = await supabase
    .from('fms_hr_attendance')
    .select('*')
    .eq('employee_id', selectedEmployee.id)
    .eq('attendance_date', attendanceDate)
    .maybeSingle();

  if (lookupError) {
    console.error('Attendance lookup failed:', lookupError);
    return;
  }

  // CLOCK IN
  if (eventType === 'CLOCK_IN') {
    if (existingAttendance?.time_in) {
      console.warn('Employee has already clocked in today.');
      return;
    }

    const { error } = await supabase
      .from('fms_hr_attendance')
      .insert({
        employee_id: selectedEmployee.id,
        attendance_date: attendanceDate,
        time_in: currentTime,
        status: 'PRESENT',
        notes: 'Biometric simulator test',
      });

    if (error) {
      console.error('Clock-in failed:', error);
      return;
    }
  }

  // CLOCK OUT
  if (eventType === 'CLOCK_OUT') {
    if (!existingAttendance) {
      console.warn('Employee has not clocked in today.');
      return;
    }

    if (existingAttendance.time_out) {
      console.warn('Employee has already clocked out today.');
      return;
    }

    if (!existingAttendance.time_in) {
      console.warn('Employee does not have a clock-in time.');
      return;
    }

    const [inHours, inMinutes, inSeconds] =
      existingAttendance.time_in.split(':').map(Number);

    const [outHours, outMinutes, outSeconds] =
      currentTime.split(':').map(Number);

    const clockInSeconds =
      inHours * 3600 +
      inMinutes * 60 +
      inSeconds;

    const clockOutSeconds =
      outHours * 3600 +
      outMinutes * 60 +
      outSeconds;

    const hoursWorked = Math.max(
      0,
      (clockOutSeconds - clockInSeconds) / 3600,
    );

    const { error } = await supabase
      .from('fms_hr_attendance')
      .update({
        time_out: currentTime,
        hours_worked: Number(hoursWorked.toFixed(2)),
      })
      .eq('id', existingAttendance.id);
    if (error) {
      console.error('Clock-out failed:', error);
      return;
    }
  }
    // Show the successful simulated device event on screen
  const event: SimulatedAttendanceEvent = {
    id: crypto.randomUUID(),
    deviceId: 'DUR-ATT-01',
    factory: 'Durban Factory',
    employeeId: selectedEmployee.id,
    employeeNumber: selectedEmployee.employee_number || '',
    employeeName: `${selectedEmployee.first_name} ${selectedEmployee.last_name}`,
    eventType,
    timestamp: now.toISOString(),
  };

  setEvents((current) => [event, ...current]);
};

  const formatEventTime = (timestamp: string) =>
    new Date(timestamp).toLocaleString('en-ZA', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Fingerprint className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Biometric Attendance</h1>
          </div>

          <p className="text-muted-foreground">
            Simulate fingerprint attendance events before connecting physical
            biometric hardware.
          </p>
        </div>

        <Badge variant="secondary" className="w-fit gap-2">
          <TestTube2 className="h-4 w-4" />
          TEST MODE
        </Badge>
      </div>

      {/* Device Information */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Factory</CardDescription>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5" />
              Durban Factory
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Attendance Device</CardDescription>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Monitor className="h-5 w-5" />
              DUR-ATT-01
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Connection</CardDescription>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Badge variant="outline">SIMULATOR</Badge>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Simulator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5" />
            Simulate Fingerprint Scan
          </CardTitle>

          <CardDescription>
            Select an active employee and simulate the event that a real
            biometric device would eventually send to the ERP.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Employee</label>

            <Select
              value={selectedEmployeeId}
              onValueChange={setSelectedEmployeeId}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loading
                      ? 'Loading employees...'
                      : 'Select an employee'
                  }
                />
              </SelectTrigger>

              <SelectContent>
                {activeEmployees.map((employee: any) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.employee_number} — {employee.first_name}{' '}
                    {employee.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedEmployee && (
            <div className="rounded-lg border bg-muted/40 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-background p-2">
                  <UserCheck className="h-5 w-5" />
                </div>

                <div>
                  <p className="font-medium">
                    {selectedEmployee.first_name}{' '}
                    {selectedEmployee.last_name}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {selectedEmployee.employee_number}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              size="lg"
              disabled={!selectedEmployee}
              onClick={() => simulateAttendance('CLOCK_IN')}
              className="gap-2"
            >
              <Clock className="h-5 w-5" />
              Simulate Clock In
            </Button>

            <Button
              type="button"
              size="lg"
              variant="outline"
              disabled={!selectedEmployee}
              onClick={() => simulateAttendance('CLOCK_OUT')}
              className="gap-2"
            >
              <Clock className="h-5 w-5" />
              Simulate Clock Out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Simulated Events */}
      <Card>
        <CardHeader>
          <CardTitle>Simulated Events</CardTitle>

          <CardDescription>
            These simulated Events are being processed through the same attendance table that the future biometric hardware will use.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {events.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No simulated attendance events yet.
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-muted p-2">
                      <Fingerprint className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="font-medium">
                        {event.employeeNumber} — {event.employeeName}
                      </p>

                      <p className="text-sm text-muted-foreground">
                        {event.factory} · {event.deviceId}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <Badge
                      variant={
                        event.eventType === 'CLOCK_IN'
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {event.eventType === 'CLOCK_IN'
                        ? 'CLOCK IN'
                        : 'CLOCK OUT'}
                    </Badge>

                    <span className="text-sm text-muted-foreground">
                      {formatEventTime(event.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceSimulator;