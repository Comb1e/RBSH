# Main Problem

Using the network parameters, system demands, unit commitment statuses, and other data provided in the attached file P6.xls, determine the economic dispatch schedule for 12:00 PM.
The objective is to minimize the total operating cost while satisfying all system physical constraints and individual unit operational constraints.
Note that The objective function is a quadratic function, and the constraints are linear equations or inequalities.

Workflow:

1. Forecast the system load demand for the next day or week and use it as the scheduling load requirement.
2. Determine the unit commitment (start-up and shut-down) schedule using the Unit Commitment method.
3. Calculate the power output of each unit using the Economic Dispatch method.

Requirements:

1. Implement the solution in python3.13, use main.py for overall calling.
2. Output as a excel. The name is "Output.xls"
3. Use qpsolvers if you know how to use this library in python.
