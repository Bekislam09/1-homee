import React, { useState } from 'react';

const First = () => {
    const[num, setNum] = useState(0)

    const plus = () =>{
        if (num + 5 > 20){
            setNum(20)
        } else {
            setNum(num + 5)
        }
    }

    const minus = () =>{
        if (num - 5 < 0){
            setNum(0)
        } else{
            setNum(num - 5)
        }
    }
    return (
        <div>
            <button onClick={plus}>+5</button>
            <h1>{num}</h1>
            <button onClick={minus}>-5</button>
        </div>
    );
}

export default First;
