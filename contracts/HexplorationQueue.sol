// Processing phases:
// - Open or closed to submissions

// Enums:
// Processing Phases:
// Start (0 - default), Submission, Processing, PlayThrough, Closed
// Move Selections:
// explore, setup camp, take down camp, dig, rest, attack, trade

// Closes during processing. No moves can be submitted until processing is complete.
// Store moves to be processed at end of phase
    // Clears out at end of every phase, shouldn't be too backed up
    // Moves cannot be submitted to queue between phases; 
    // keeper will store processed moves, empty queue, and set status if ready.

// How are moves stored?
// PlayerID, Move choice (travel, dig, rest, etc.), options[]
// uint256 queueIndex = 0; // increase with each phase processed so we don't have to clean the queue
// mappings from queue index
// mapping( uint256 => uint16) currentQueuePosition // increases with each player in queue, then back to 0
// mapping( uint256 => uint16) playThroughPosition // in case we need to batch this too... hopefully not.
// mappings from queue index => player id
// mapping( uint256 => mapping(uint256 => Move enum)) move;
// mapping( uint256 => mapping(uint256 => string[])) options;
// mapping( uint256 => mapping(uint256 => uint256[])) players // all players with moves to process

// players can have 1 move stored at a time. 
// once a move is submitted, that's it for that phase.

// verified controller role only...
// submitMoveForPlayer(moveindex, playerID, options){
//    // if (move[queueIndex][playerID] == 0){
      //    submit moves
      //  }
//}
//}

// Verified Loop role only...
// beginProcessing(){
    // set processingPhase to "processing"
//}

// continueProcessing//
    // figure out most expensive move and only do as many as can be safely completed
    // in one transaction
    // start at currentQueuePosition
    // after each move is processed currentQueuePosition++ 
    // on after final batch, switch day / night and call playThrough()

    // What is processing?
        // take all moves from batch, verify are valid moves, and 
        // return list of final moves to process
        // keeper will post list of final moves to contract, 
        // *shouldn't be able to fail if it got this far

// playThrough(){
    // if day phase (){
        // Play through events 
        // daily events
    //}

    // if (end game) {
        // play enemy stuff here
    //}
//}

// finishProcessing(){
    //  increase queue index
//}

// Phase flow:
// start, submission, processing,      play through,     submission,      processing,        play through,    submission,      processing
// Land, first moves, play out moves,                   review outcomes   play out moves, 
//                    Start next phase                  submit moves      Start next phase
//                                     If phase == day:                                      If phase == day:
//                                     Run Events etc                                        Run events etc